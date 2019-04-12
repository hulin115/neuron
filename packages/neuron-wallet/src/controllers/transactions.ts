import { ResponseCode, ChannelResponse } from '.'
import WalletChannel from '../channel/wallet'
import TransactionsService, {
  Transaction,
  TransactionsByAddressesParam,
  PaginationResult,
  TransactionsByLockHashesParam,
} from '../services/transactions'

export default class TransactionsController {
  public channel: WalletChannel

  static service = new TransactionsService()

  constructor(channel: WalletChannel) {
    this.channel = channel
  }

  public static getAll = async (
    params: TransactionsByLockHashesParam,
  ): Promise<ChannelResponse<PaginationResult<Transaction>>> => {
    const transactions = await TransactionsService.getAll(params)

    if (!transactions) {
      return {
        status: ResponseCode.Fail,
        msg: 'Transactions not found',
      }
    }

    return {
      status: ResponseCode.Success,
      result: { ...params, ...transactions },
    }
  }

  public static getAllByAddresses = async (
    params: TransactionsByAddressesParam,
  ): Promise<ChannelResponse<PaginationResult<Transaction>>> => {
    const transactions = await TransactionsService.getAllByAddresses(params)

    if (transactions) {
      return {
        status: ResponseCode.Success,
        result: transactions,
      }
    }
    return {
      status: ResponseCode.Fail,
      msg: 'Transactions not found',
    }
  }

  public static get = async (hash: string): Promise<ChannelResponse<Transaction>> => {
    const transaction = await TransactionsService.get(hash)
    if (!transaction) {
      return {
        status: ResponseCode.Fail,
        msg: 'Transaction not found',
      }
    }
    return {
      status: ResponseCode.Success,
      result: transaction,
    }
  }
}
