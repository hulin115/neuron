import { getConnection, In } from 'typeorm'
import OutputEntity from 'database/chain/entities/output'
import { Cell, OutPoint, Input } from 'types/cell-types'
import { CapacityNotEnough, CapacityNotEnoughForChange } from 'exceptions'
import { OutputStatus } from './tx/params'
import SkipDataAndType from './settings/skip-data-and-type'

export const MIN_CELL_CAPACITY = '6100000000'

/* eslint @typescript-eslint/no-unused-vars: "warn" */
/* eslint no-await-in-loop: "warn" */
/* eslint no-restricted-syntax: "warn" */
export default class CellsService {
  // exclude hasData = true and typeScript != null
  public static getBalance = async (
    lockHashes: string[],
    status: OutputStatus,
    skipDataAndType: boolean
  ): Promise<string> => {
    const queryParams = {
      lockHash: In(lockHashes),
      status,
    }

    if (skipDataAndType) {
      Object.assign(queryParams, {
        hasData: false,
        typeScript: null,
      })
    }

    const cells: OutputEntity[] = await getConnection()
      .getRepository(OutputEntity)
      .find({
        where: queryParams,
      })

    const capacity: bigint = cells.map(c => BigInt(c.capacity)).reduce((result, c) => result + c, BigInt(0))

    return capacity.toString()
  }

  public static getLiveCell = async (outPoint: OutPoint): Promise<Cell | undefined> => {
    const cellEntity: OutputEntity | undefined = await CellsService.getLiveCellEntity(outPoint)

    if (!cellEntity) {
      return undefined
    }

    return cellEntity.toInterface()
  }

  private static getLiveCellEntity = async (outPoint: OutPoint): Promise<OutputEntity | undefined> => {
    const cellEntity: OutputEntity | undefined = await getConnection()
      .getRepository(OutputEntity)
      .findOne({
        outPointTxHash: outPoint.txHash,
        outPointIndex: outPoint.index,
        status: 'live',
      })

    return cellEntity
  }

  // gather inputs for generateTx
  public static gatherInputs = async (
    capacity: string,
    lockHashes: string[],
    fee: string = '0'
  ): Promise<{
    inputs: Input[]
    capacities: string
  }> => {
    const capacityInt = BigInt(capacity)
    const feeInt = BigInt(fee)
    const totalCapacities: bigint = capacityInt + feeInt

    // use min secp size (without data)
    const minChangeCapacity = BigInt(MIN_CELL_CAPACITY)

    if (capacityInt < BigInt(MIN_CELL_CAPACITY)) {
      throw new Error(`capacity can't be less than ${MIN_CELL_CAPACITY}`)
    }

    const queryParams = {
      lockHash: In(lockHashes),
      status: OutputStatus.Live,
    }
    const skipDataAndType = SkipDataAndType.getInstance().get()
    if (skipDataAndType) {
      Object.assign(queryParams, {
        hasData: false,
        typeScript: null,
      })
    }

    // only live cells, skip which has data or type
    const cellEntities: OutputEntity[] = await getConnection()
      .getRepository(OutputEntity)
      .find({
        where: queryParams,
      })
    cellEntities.sort((a, b) => {
      const result = BigInt(a.capacity) - BigInt(b.capacity)
      if (result > BigInt(0)) {
        return 1
      }
      if (result === BigInt(0)) {
        return 0
      }
      return -1
    })

    const inputs: Input[] = []
    let inputCapacities: bigint = BigInt(0)
    cellEntities.every(cell => {
      const input: Input = {
        previousOutput: cell.outPoint(),
        since: '0',
        lock: cell.lock,
        lockHash: cell.lockHash,
        capacity: cell.capacity,
      }
      inputs.push(input)
      inputCapacities += BigInt(cell.capacity)

      const diff = inputCapacities - totalCapacities
      if (diff >= minChangeCapacity || diff === BigInt(0)) {
        return false
      }
      return true
    })

    if (inputCapacities < totalCapacities) {
      throw new CapacityNotEnough()
    }

    const diffCapacities = inputCapacities - totalCapacities
    if (diffCapacities < minChangeCapacity && diffCapacities !== BigInt(0)) {
      throw new CapacityNotEnoughForChange()
    }

    return {
      inputs,
      capacities: inputCapacities.toString(),
    }
  }

  public static allBlake160s = async (): Promise<string[]> => {
    const outputEntities = await getConnection()
      .getRepository(OutputEntity)
      .createQueryBuilder('output')
      .getMany()
    const blake160s: string[] = outputEntities
      .map(output => {
        const { lock } = output
        if (!lock) {
          return undefined
        }
        const { args } = lock
        if (!args) {
          return undefined
        }
        return args
      })
      .filter(blake160 => !!blake160) as string[]

    const uniqueBlake160s = [...new Set(blake160s)]

    return uniqueBlake160s
  }
}
