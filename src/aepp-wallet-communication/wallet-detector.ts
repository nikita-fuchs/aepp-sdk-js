import BrowserConnection from './connection/Browser';
import BrowserWindowMessageConnection from './connection/BrowserWindowMessage';
import { MESSAGE_DIRECTION, METHODS } from './schema';
import { UnsupportedPlatformError } from '../utils/errors';

interface Wallet {
  info: {
    id: string;
    type: string;
    origin: string;
  };
  getConnection: () => BrowserWindowMessageConnection;
}
interface Wallets { [key: string]: Wallet }

/**
 * A function to detect available wallets
 * @category aepp wallet communication
 * @param connection - connection to use to detect wallets
 * @param onDetected - call-back function which trigger on new wallet
 * @returns a function to stop scanning
 */
export default (
  connection: BrowserConnection,
  onDetected: ({ wallets, newWallet }: { wallets: Wallets; newWallet: Wallet }) => void,
): () => void => {
  if (window == null) throw new UnsupportedPlatformError('Window object not found, you can run wallet detector only in browser');
  const wallets: Wallets = {};

  connection.connect((
    { method, params }: { method: string; params: Wallet['info'] },
    origin: string,
    source: Window,
  ) => {
    if (method !== METHODS.readyToConnect || wallets[params.id] != null) return;

    const wallet = {
      info: params,
      getConnection() {
        const isExtension = params.type === 'extension';
        return new BrowserWindowMessageConnection({
          sendDirection: isExtension ? MESSAGE_DIRECTION.to_waellet : undefined,
          receiveDirection: isExtension ? MESSAGE_DIRECTION.to_aepp : undefined,
          target: source,
          origin: isExtension ? window.origin : params.origin,
        });
      },
    };
    wallets[wallet.info.id] = wallet;
    onDetected({ wallets, newWallet: wallet });
  }, () => {});

  return () => connection.disconnect();
};
