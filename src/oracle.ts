/**
 * Oracle methods - routines to interact with the æternity oracle system
 *
 * The high-level description of the oracle system is
 * https://github.com/aeternity/protocol/blob/master/ORACLE.md in the protocol
 * repository.
 */

import { mapObject, pause } from './utils/other';
import { buildTxAsync, BuildTxOptions } from './tx/builder';
import { Tag } from './tx/builder/constants';
import {
  decode, encode, Encoded, Encoding,
} from './utils/encoder';
import { _getPollInterval } from './chain';
import { sendTransaction, SendTransactionOptions } from './send-transaction';
import Node from './Node';
import AccountBase from './account/Base';
import { OracleQueryNode } from './oracle/OracleBase';

/**
 * Poll for oracle queries
 * @category oracle
 * @param oracleId - Oracle public key
 * @param onQuery - OnQuery callback
 * @param options - Options object
 * @param options.interval - Poll interval(default: 5000)
 * @param options.onNode - Node to use
 * @returns Callback to stop polling function
 */
export function pollForQueries(
  oracleId: Encoded.OracleAddress,
  onQuery: (query: OracleQueryNode) => void,
  { interval, ...options }: { interval?: number; onNode: Node }
  & Parameters<typeof _getPollInterval>[1],
): () => void {
  const knownQueryIds = new Set();
  const checkNewQueries = async (): Promise<void> => {
    const queries = ((await options.onNode.getOracleQueriesByPubkey(oracleId)).oracleQueries ?? [])
      .filter(({ id }) => !knownQueryIds.has(id));
    queries.forEach((query) => {
      knownQueryIds.add(query.id);
      onQuery(query);
    });
  };

  let stopped = false;

  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  (async () => {
    interval ??= await _getPollInterval('micro-block', options);
    while (!stopped) { // eslint-disable-line no-unmodified-loop-condition
      // TODO: allow to handle this error somehow
      await checkNewQueries().catch(console.error);
      await pause(interval);
    }
  })();
  return () => { stopped = true; };
}

/**
 * Extend oracle ttl
 * @category oracle
 * @param options - Options object
 * @returns Oracle object
 */
export async function extendOracleTtl(options: ExtendOracleTtlOptions): Promise<
Awaited<ReturnType<typeof sendTransaction>> & Awaited<ReturnType<typeof getOracleObject>>
> {
  const oracleId = encode(decode(options.onAccount.address), Encoding.OracleAddress);
  const oracleExtendTx = await buildTxAsync({
    _isInternalBuild: true,
    ...options,
    tag: Tag.OracleExtendTx,
    oracleId,
  });
  return {
    ...await sendTransaction(oracleExtendTx, options),
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    ...await getOracleObject(oracleId, options),
  };
}

type ExtendOracleTtlOptionsType = SendTransactionOptions & Parameters<typeof getOracleObject>[1]
& BuildTxOptions<Tag.OracleExtendTx, 'callerId' | 'oracleId'>;
interface ExtendOracleTtlOptions extends ExtendOracleTtlOptionsType {}

/**
 * Extend oracle ttl
 * @category oracle
 * @param queryId - Oracle query id
 * @param response - Oracle query response
 * @param options - Options object
 * @returns Oracle object
 */
export async function respondToQuery(
  queryId: Encoded.OracleQueryId,
  response: string,
  options: RespondToQueryOptions,
): Promise<
  Awaited<ReturnType<typeof sendTransaction>> & Awaited<ReturnType<typeof getOracleObject>>
  > {
  const oracleId = encode(decode(options.onAccount.address), Encoding.OracleAddress);
  const oracleRespondTx = await buildTxAsync({
    _isInternalBuild: true,
    ...options,
    tag: Tag.OracleResponseTx,
    oracleId,
    queryId,
    response,
  });
  return {
    ...await sendTransaction(oracleRespondTx, options),
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    ...await getOracleObject(oracleId, options),
  };
}

type RespondToQueryOptionsType = SendTransactionOptions & Parameters<typeof getOracleObject>[1]
& BuildTxOptions<Tag.OracleResponseTx, 'callerId' | 'oracleId' | 'queryId' | 'response'>;
interface RespondToQueryOptions extends RespondToQueryOptionsType {}

/**
 * Constructor for Oracle Object (helper object for using Oracle)
 * @category oracle
 * @param oracleId - Oracle public key
 * @param options - Options
 * @returns Oracle object
 */
export async function getOracleObject(
  oracleId: Encoded.OracleAddress,
  options: { onNode: Node; onAccount: AccountBase },
): Promise<GetOracleObjectReturnType> {
  return {
    ...await options.onNode.getOracleByPubkey(oracleId),
    queries: (await options.onNode.getOracleQueriesByPubkey(oracleId)).oracleQueries,
    ...mapObject<Function, Function>(
      {
        pollQueries: pollForQueries,
        respondToQuery,
        extendOracle: extendOracleTtl,
      },
      ([name, handler]) => [
        name,
        (...args: any) => {
          const lastArg = args[args.length - 1];
          if (lastArg != null && typeof lastArg === 'object' && lastArg.constructor === Object) {
            Object.assign(lastArg, { ...options, ...lastArg });
          } else args.push(options);
          return handler(
            ...['extendOracle', 'respondToQuery'].includes(name) ? [] : [oracleId],
            ...args,
          );
        },
      ],
    ),
  } as any;
}

interface GetOracleObjectReturnType extends Awaited<ReturnType<Node['getOracleByPubkey']>> {
  id: Encoded.OracleAddress;
  queries: OracleQueryNode[];
  // TODO: replace getOracleObject with a class
  pollQueries: (cb: Parameters<typeof pollForQueries>[1]) => ReturnType<typeof pollForQueries>;
  respondToQuery: Function;
  extendOracle: Function;
  getQuery: Function;
}

/**
 * Register oracle
 * @category oracle
 * @param queryFormat - Format of query
 * @param responseFormat - Format of query response
 * @param options - Options
 * @returns Oracle object
 */
export async function registerOracle(
  queryFormat: string,
  responseFormat: string,
  options: RegisterOracleOptions,
): Promise<
  Awaited<ReturnType<typeof sendTransaction>> & Awaited<ReturnType<typeof getOracleObject>>
  > {
  const accountId = options.onAccount.address;
  const oracleRegisterTx = await buildTxAsync({
    _isInternalBuild: true,
    ...options,
    tag: Tag.OracleRegisterTx,
    accountId,
    queryFormat,
    responseFormat,
  });
  return {
    ...await sendTransaction(oracleRegisterTx, options),
    ...await getOracleObject(encode(decode(accountId), Encoding.OracleAddress), options),
  };
}

type RegisterOracleOptionsType = SendTransactionOptions & Parameters<typeof getOracleObject>[1]
& BuildTxOptions<Tag.OracleRegisterTx, 'accountId' | 'queryFormat' | 'responseFormat'>;
interface RegisterOracleOptions extends RegisterOracleOptionsType {}
