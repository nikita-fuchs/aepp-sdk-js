#!/usr/bin/env node
/*
 * ISC License (ISC)
 * Copyright (c) 2022 aeternity developers
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
// # Compile & Deploy a Sophia Smart Contract
//
// ## Introduction
// The whole script is [located in the repository](https://github.com/aeternity/aepp-sdk-js/blob/master/examples/node/contract-interaction.mjs) and this page explains in detail how to:
//
// - deal with the different phases of compiling Sophia contracts to bytecode
// - deploy the bytecode to get a callable contract address
// - invoke the deployed contract on the æternity blockchain

// ## 1. Specify imports
//
// You need to import `AeSdk`, `Node` and `MemoryAccount` classes from the SDK.
import { AeSdk, Node, MemoryAccount } from '@aeternity/aepp-sdk';

// **Note**:
//
//  - You need to have the SDK installed via `npm i @aetenity/aepp-sdk -g` to run that example code.

// ## 2. Define constants
// The following constants are used in the subsequent code snippets.
// typically you read the source code from a separate .aes file
const CONTRACT_SOURCE_CODE = `
contract Multiplier =
  record state = { factor: int }
  entrypoint init(f : int) : state = { factor = f }
  stateful entrypoint setFactor(f : int): int =
    put(state{ factor = f })
    f * 10
  entrypoint multiplyBy(x : int) = x * state.factor
`;
const ACCOUNT_SECRET_KEY = 'bf66e1c256931870908a649572ed0257876bb84e3cdf71efb12f56c7335fad54d5cf08400e988222f26eb4b02c8f89077457467211a6e6d955edb70749c6a33b';
const NODE_URL = 'https://testnet.aeternity.io';
const COMPILER_URL = 'https://compiler.aepps.com';

// Note:
//
//  - The secret key of the account is pre-funded and only used for demonstration purpose
//      - You should replace it with your own keypair (see
//        [Create a Keypair](../../quick-start.md#2-create-a-keypair))
//  - In case the account runs out of funds you can always request AE using the [Faucet](https://faucet.aepps.com/)

// ## 3. Create object instances
const account = new MemoryAccount(ACCOUNT_SECRET_KEY);
const node = new Node(NODE_URL);
const aeSdk = new AeSdk({
  nodes: [{ name: 'testnet', instance: node }],
  accounts: [account],
  compilerUrl: COMPILER_URL,
});

// ## 4. Get contract instance
// Knowing the source code allows you to initialize a contract instance and interact with the
// contract in a convenient way.
console.log(CONTRACT_SOURCE_CODE);
const contract = await aeSdk.initializeContract({ sourceCode: CONTRACT_SOURCE_CODE });

// ## 5. Compile the contract
// The `$compile` function sends a raw Sophia contract as string
// to the HTTP compiler for bytecode compilation. In the future this will be done
// without talking to the node, but requiring a bytecode compiler
// implementation directly in the SDK.
const bytecode = await contract.$compile();
console.log(`Obtained bytecode ${bytecode}`);

// ## 6. Deploy the contract
// Invoking `$deploy` on the contract instance will result in the `CreateContractTx`
// being created, signed (using the _secretKey_ of the previously defined `MemoryAccount`) and
// broadcasted to the network. It will be picked up by the miners and written to the chain.

const deployInfo = await contract.$deploy([5]);
console.log(`Contract deployed at ${deployInfo.address}`);

// Note:
//
//  - Sophia contracts always have an `init` function which needs to be invoked.
//  - The SDK generates the required `calldata` for the provided arguments by
//    `@aeternity/aepp-calldata` package.

// ## 7. Call a contract function
// Once the `ContractCreateTx` has been successfully mined, you can attempt to invoke
// any public function (aka `entrypoint` in Sophia) defined within it.

await contract.setFactor(6);

// **Note**:
//
//  - `setFactor` is a stateful entrypoint that changes to the contract's state so `contract`
//    broadcasting the transaction to be mined

// ## 8. Call a contract function via dry-run
// You can use `callStatic` option which performs a `dry-run` of the
// transaction which allows you to get the result without having to mine a transaction.

let call = await contract.setFactor(7, { callStatic: true });

// ## 9. Decode the call result
// The execution result, if successful, will be an FATE-encoded result value.
// The `decodedResult` property will contain the result value decoded using calldata package.

console.log(`setFactor execution result: ${call.decodedResult}`);

// ## 10. Call a contract non-stateful entrypoint via dry-run

call = await contract.multiplyBy(8);
console.log(`multiplyBy execution result: ${call.decodedResult}`);

// **Note**:
//
//  - The `contract` automatically chooses to perform a dry-run call as `multiplyBy` is a
//    non-stateful entrypoint
//  - if `multiplyBy` would be a `stateful entrypoint` the transaction would be broadcasted to
//    the network and picked up by miners
