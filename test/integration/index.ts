import { after } from 'mocha';
import {
  AeSdk, CompilerHttpNode, CompilerCli8, MemoryAccount, Node, Encoded, ConsensusProtocolVersion,
} from '../../src';
import '..';

export const networkId = process.env.NETWORK_ID ?? 'ae_devnet';

const configuration = {
  ae_mainnet: {
    url: 'https://mainnet.aeternity.io',
    channelUrl: 'wss://mainnet.aeternity.io/channel',
    compilerUrl: 'https://v7.compiler.aeternity.io',
    getGenesisAccount: () => new MemoryAccount('bd07bbaec089c018f41f244d46da41dc2d5cee2eb374542bb2d663d1aef88c65b7f6a108650fabe6b81ef2630ceb7b252974915c158884b03d9b851fdc74e36b'),
  },
  ae_uat: {
    url: 'https://testnet.aeternity.io',
    channelUrl: 'wss://testnet.aeternity.io/channel',
    compilerUrl: 'https://v7.compiler.aeternity.io',
    getGenesisAccount: async () => {
      const account = MemoryAccount.generate();
      // @ts-expect-error
      const { status } = await fetch(
        `https://faucet.aepps.com/account/${account.address}`,
        { method: 'POST' },
      );
      console.assert([200, 425].includes(status), 'Invalid faucet response code', status);
      return account;
    },
  },
  ae_devnet: {
    url: 'http://localhost:3013',
    channelUrl: 'ws://localhost:3014/channel',
    compilerUrl: 'http://localhost:3080',
    getGenesisAccount: () => new MemoryAccount(
      'bd07bbaec089c018f41f244d46da41dc2d5cee2eb374542bb2d663d1aef88c65b7f6a108650fabe6b81ef2630ceb7b252974915c158884b03d9b851fdc74e36b',
    ),
    sdkOptions: {
      _expectedMineRate: 1000,
      _microBlockCycle: 300,
    },
  },
}[networkId];
if (configuration == null) throw new Error(`Unknown network id: ${networkId}`);
export const { url, channelUrl, compilerUrl } = configuration;
const { sdkOptions } = configuration;

type TransactionHandler = (tx: Encoded.Transaction) => unknown;
const transactionHandlers: TransactionHandler[] = [];

export function addTransactionHandler(cb: TransactionHandler): void {
  transactionHandlers.push(cb);
}

class NodeHandleTx extends Node {
  // @ts-expect-error use code generation to create node class?
  override async postTransaction(
    ...args: Parameters<Node['postTransaction']>
  ): ReturnType<Node['postTransaction']> {
    transactionHandlers.forEach((cb) => cb(args[0].tx as Encoded.Transaction));
    return super.postTransaction(...args);
  }
}

const genesisAccountPromise = configuration.getGenesisAccount();
/* export const isLimitedCoins = networkId !== 'ae_devnet'; */
export const isLimitedCoins = true;

export async function getSdk(accountCount = 1): Promise<AeSdk> {
  const accounts = new Array(accountCount).fill(null).map(() => MemoryAccount.generate());
  const sdk = new AeSdk({
    onCompiler: new CompilerHttpNode(compilerUrl),
    nodes: [{ name: 'test', instance: new NodeHandleTx(url) }],
    accounts,
    ...sdkOptions,
  });
  // TODO: remove after release aesophia_http@8
  if ((await sdk.api.getNodeInfo()).consensusProtocolVersion === ConsensusProtocolVersion.Ceres) {
    sdk._options.onCompiler = new CompilerCli8();
  }
  const genesisAccount = await genesisAccountPromise;
  for (let i = 0; i < accounts.length; i += 1) {
    await sdk.spend(
      isLimitedCoins ? 1e16 : 5e18,
      accounts[i].address,
      { onAccount: genesisAccount },
    );
  }
  after(async () => Promise.allSettled(
    accounts.map(async (onAccount) => sdk.transferFunds(1, genesisAccount.address, { onAccount })),
  ));
  return sdk;
}
