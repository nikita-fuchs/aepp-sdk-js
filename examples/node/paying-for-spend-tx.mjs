#!/usr/bin/env node
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

// # InnerTx: SpendTx
//
// ## Introduction
// The whole script is [located in the repository](https://github.com/aeternity/aepp-sdk-js/blob/master/examples/node/paying-for-spend-tx.mjs)
// and this page explains in detail how to:
//
//  - Create and sign a `SpendTx` for an account with the `innerTx` option.
//  - Wrap the signed `SpendTx` in a `PayingForTx`, signing it using an account that pays the fees
//    of the inner `SpendTx` and broadcasts it to the network.
//
// Note:
//
//  - This can be done for ***any*** transaction type!

// ## 1. Specify imports
// You need to import `AeSdk`, `Node` and `MemoryAccount` classes from the SDK.
// Additionally you import the `generateKeyPair` utility function to generate a new keypair.
import {
  AeSdk, Node, MemoryAccount, Tag,
} from '@aeternity/aepp-sdk';

// **Note**:
//
//  - You need to have the SDK installed via `npm i @aetenity/aepp-sdk -g` to run that example code.

// ## 2. Define constants
// The following constants are used in the subsequent code snippets.
const PAYER_ACCOUNT_SECRET_KEY = 'bf66e1c256931870908a649572ed0257876bb84e3cdf71efb12f56c7335fad54d5cf08400e988222f26eb4b02c8f89077457467211a6e6d955edb70749c6a33b';
const NODE_URL = 'https://testnet.aeternity.io';
const AMOUNT = 1;

// Note:
//
//  - The secret key of the account is pre-funded and only used for demonstration purpose
//      - You can replace it with your own keypair (see
//        [Create a Keypair](../../quick-start.md#2-create-a-keypair))
//      - In case the account runs out of funds you can always request AE using the [Faucet](https://faucet.aepps.com/)
//  - The `AMOUNT` (in `aettos`) will be send to the new user and returned to the payer.

// ## 3. Create object instances
const payerAccount = new MemoryAccount(PAYER_ACCOUNT_SECRET_KEY);
const newUserAccount = MemoryAccount.generate();
const node = new Node(NODE_URL);
const aeSdk = new AeSdk({
  nodes: [{ name: 'testnet', instance: node }],
  accounts: [payerAccount, newUserAccount],
});

// ## 4. Send 1 `aetto` from payer to new user
const spendTxResult = await aeSdk.spend(
  AMOUNT,
  newUserAccount.address,
  { onAccount: payerAccount },
);
console.log(spendTxResult);

// ## 5. Check balance of new user (before)
const newUserBalanceBefore = await aeSdk.getBalance(newUserAccount.address);
console.log(`new user balance (before): ${newUserBalanceBefore}`);

// Note:
//
//  - The balance should now be 1

// ## 6. Create and sign `SpendTx` on behalf of new user
const spendTx = await aeSdk.buildTx(Tag.SpendTx, {
  senderId: newUserAccount.address,
  recipientId: payerAccount.address,
  amount: AMOUNT,
});
const signedSpendTx = await aeSdk.signTransaction(
  spendTx,
  { onAccount: newUserAccount, innerTx: true },
);

// Note:
//
//  - The provided [transaction option](../../transaction-options.md) `innerTx` indicates that
//    the transaction needs to be signed in a special way

// ## 7. Create, sign & broadcast the `PayingForTx` as payer
const payForTx = await aeSdk.payForTransaction(signedSpendTx, { onAccount: payerAccount });
console.log(payForTx);

// Note:
//
//  - Normally sending the whole balance (1 `aetto`) would not be possible as the new user would
//    have to cover the transaction fee.

// ## 8. Check balance of new user (after)
const newUserBalanceAfter = await aeSdk.getBalance(newUserAccount.address);
console.log(`new user balance (after): ${newUserBalanceAfter}`);

// Note:
//
//  - The balance should now be 0
