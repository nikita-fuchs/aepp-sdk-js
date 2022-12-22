/*
 * ISC License (ISC)
 * Copyright (c) 2021 aeternity developers
 *
 *  Permission to use, copy, modify, and/or distribute this software for any
 *  purpose with or without fee is hereby granted, provided that the above
 *  copyright notice and this permission notice appear in all copies.
 *
 *  THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
 *  REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
 *  AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
 *  INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
 *  LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
 *  OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
 *  PERFORMANCE OF THIS SOFTWARE.
 */

import { encode as rlpEncode } from 'rlp';
import type { Input } from 'rlp';
import { hash } from './crypto';
import {
  MerkleTreeHashMismatchError,
  MissingNodeInTreeError,
  UnknownPathNibbleError,
  UnknownNodeLengthError,
  ArgumentError,
  InternalError,
  UnexpectedTsError,
} from './errors';

enum NodeType {
  Branch,
  Extension,
  Leaf,
}

export type MPTreeBinary = [Buffer, Array<[Buffer, Buffer[]]>];

export default class MPTree {
  readonly #rootHash: string;

  #isComplete = true;

  get isComplete(): boolean {
    return this.#isComplete;
  }

  readonly #nodes: { [key: string]: Buffer[] };

  static #nodeHash(node: Input): string {
    return Buffer.from(hash(rlpEncode(node))).toString('hex');
  }

  /**
   * Deserialize Merkle Patricia Tree
   * @param binary - Binary
   * @returns Merkle Patricia Tree
   */
  constructor(binary: MPTreeBinary) {
    this.#rootHash = binary[0].toString('hex');
    this.#nodes = Object.fromEntries(
      binary[1].map((node) => [node[0].toString('hex'), node[1]]),
    );

    if (this.#nodes[this.#rootHash] == null) {
      if (Object.keys(this.#nodes).length !== 0) {
        throw new MissingNodeInTreeError('Can\'t find a node by root hash');
      }
      this.#isComplete = false;
      return;
    }
    Object.entries(this.#nodes).forEach(([key, node]) => {
      if (MPTree.#nodeHash(node) !== key) throw new MerkleTreeHashMismatchError();
      const { type } = MPTree.#parseNode(node);
      switch (type) {
        case NodeType.Branch:
          node
            .slice(0, 16)
            .filter((n) => n.length)
            .forEach((n) => {
              if (n.length !== 32) {
                throw new ArgumentError('MPTree branch item length', 32, n.length);
              }
              if (this.#nodes[n.toString('hex')] == null) this.#isComplete = false;
            });
          break;
        case NodeType.Extension:
          if (this.#nodes[node[1].toString('hex')] == null) {
            throw new MissingNodeInTreeError('Can\'t find a node by hash in extension node');
          }
          break;
        case NodeType.Leaf:
          break;
        default:
          throw new InternalError(`Unknown MPTree node type: ${type}`);
      }
    });
  }

  isEqual(tree: MPTree): boolean {
    return this.#rootHash === tree.#rootHash;
  }

  static #parseNode(node: Buffer[]): { type: NodeType; value?: Buffer; path?: string } {
    switch (node.length) {
      case 17:
        return {
          type: NodeType.Branch,
          ...node[16].length !== 0 && { value: node[16] },
        };
      case 2: {
        const nibble = node[0][0] >> 4; // eslint-disable-line no-bitwise
        if (nibble > 3) throw new UnknownPathNibbleError(nibble);
        const type = nibble <= 1 ? NodeType.Extension : NodeType.Leaf;
        const slice = [0, 2].includes(nibble) ? 2 : 1;
        return {
          type,
          ...type === NodeType.Leaf && { value: node[1] },
          path: node[0].toString('hex').slice(slice),
        };
      }
      default:
        throw new UnknownNodeLengthError(node.length);
    }
  }

  /**
   * Serialize Merkle Patricia Tree
   * @returns Binary
   */
  serialize(): MPTreeBinary {
    return [
      Buffer.from(this.#rootHash, 'hex'),
      Object.entries(this.#nodes).map(([mptHash, value]) => ([
        Buffer.from(mptHash, 'hex'),
        value,
      ])),
    ];
  }

  /**
   * Retrieve value from Merkle Patricia Tree
   * @param _key - The key of the element to retrieve
   * @returns Value associated to the specified key
   */
  get(_key: string): Buffer | undefined {
    let searchFrom = this.#rootHash;
    let key = _key;
    while (true) { // eslint-disable-line no-constant-condition
      const node = this.#nodes[searchFrom];
      if (node == null) {
        if (!this.isComplete) return undefined;
        throw new InternalError('Can\'t find node in complete tree');
      }
      const { type, value, path } = MPTree.#parseNode(node);
      switch (type) {
        case NodeType.Branch:
          if (key.length === 0) return value;
          searchFrom = node[+`0x${key[0]}`].toString('hex');
          key = key.substring(1);
          break;
        case NodeType.Extension:
          if (key.substring(0, path?.length) !== path) return undefined;
          searchFrom = node[1].toString('hex');
          key = key.substring(path.length);
          break;
        case NodeType.Leaf:
          if (path !== key) return undefined;
          return value;
        default:
          throw new InternalError(`Unknown MPTree node type: ${type}`);
      }
    }
  }

  #entriesRaw(): Array<[string, Buffer]> {
    const entries: Array<[string, Buffer]> = [];
    const rec = (searchFrom: string, key: string): void => {
      const node = this.#nodes[searchFrom];
      if (node == null) {
        if (!this.isComplete) return;
        throw new InternalError('Can\'t find node in complete tree');
      }
      const { type, value, path } = MPTree.#parseNode(node);
      switch (type) {
        case NodeType.Branch:
          node
            .slice(0, 16)
            .map((t, idx): [typeof t, number] => [t, idx])
            .filter(([t]) => t.length)
            .forEach(([t, idx]) => rec(t.toString('hex'), key + idx.toString(16)));
          if (value != null) entries.push([key, value]);
          break;
        case NodeType.Extension:
          rec(node[1].toString('hex'), key + path);
          break;
        case NodeType.Leaf:
          if (value == null) throw new UnexpectedTsError();
          entries.push([key + path, value]);
          break;
        default:
          throw new InternalError(`Unknown MPTree node type: ${type}`);
      }
    };
    rec(this.#rootHash, '');
    return entries;
  }
}
