import { describe, it, expect } from 'vitest'
import {
  hostCodeOf,
  isValidCustomerCode,
  customerByCode,
  matchCustomerCode,
  vehiclesForCustomer,
  isValidVehicleCode,
  resolveCustomerAuthority,
  vehicleLabel,
} from '@/domain/customerCodeSync'

describe('customerCodeSync —— 客户/车型统一到 CJQW0106 附表1/附表2', () => {
  it('hostCodeOf 从附表2 host 后缀提取顾客编码', () => {
    expect(hostCodeOf('一汽集团(一汽轿车股份、一汽新能源、一汽解放、一汽马自达、天津一汽夏利等)\n(0A)')).toBe('0A')
    expect(hostCodeOf('ES(此处所列车型为目标车型，非量产车型）')).toBe(null)
  })

  it('isValidCustomerCode 校验附表1 顾客编码与 ES 前瞻编码', () => {
    expect(isValidCustomerCode('0A')).toBe(true)
    expect(isValidCustomerCode('0U')).toBe(true)
    expect(isValidCustomerCode('AB')).toBe(true)
    expect(isValidCustomerCode('ES')).toBe(true)
    expect(isValidCustomerCode('CUST-SGMW')).toBe(false)
    expect(isValidCustomerCode('ZZ')).toBe(false)
  })

  it('customerByCode 返回附表1 权威客户信息', () => {
    const c = customerByCode('0U')
    expect(c?.short).toBe('比亚迪')
    expect(customerByCode('ZZ')).toBeNull()
  })

  it('matchCustomerCode 按简称/英文/名称匹配权威编码', () => {
    expect(matchCustomerCode('比亚迪')?.code).toBe('0U')
    expect(matchCustomerCode('BYD')?.code).toBe('0U')
    expect(matchCustomerCode('吉利汽车')?.code).toBe('0L')
    expect(matchCustomerCode('不存在客户')).toBeNull()
  })

  it('vehiclesForCustomer 按顾客编码联动过滤附表2 车型', () => {
    const byd = vehiclesForCustomer('0U')
    expect(byd.length).toBeGreaterThan(0)
    expect(byd.every((v) => v.host.includes('(0U)'))).toBe(true)
    expect(vehiclesForCustomer('ZZ')).toEqual([])
  })

  it('isValidVehicleCode 校验 2 位车型代码且禁用 O/I/J/V', () => {
    expect(isValidVehicleCode('0A')).toBe(true)
    expect(isValidVehicleCode('1B')).toBe(true)
    expect(isValidVehicleCode('0O')).toBe(false) // 禁用 O
    expect(isValidVehicleCode('0I')).toBe(false) // 禁用 I
    expect(isValidVehicleCode('0J')).toBe(false) // 禁用 J
    expect(isValidVehicleCode('0V')).toBe(false) // 禁用 V
    expect(isValidVehicleCode('A')).toBe(false) // 长度错误
  })

  it('resolveCustomerAuthority 将旧自定义编号映射为权威编码（fail-closed）', () => {
    expect(resolveCustomerAuthority({ code: '0U', name: '比亚迪' })?.code).toBe('0U')
    expect(resolveCustomerAuthority({ code: 'CUST-BYD', name: '比亚迪' })?.code).toBe('0U')
    expect(resolveCustomerAuthority({ code: 'CUST-X', name: '不存在的客户' })).toBeNull()
  })

  it('vehicleLabel 生成「代码 名称」展示', () => {
    expect(vehicleLabel({ host: 'x(0U)', code: '0A', name: 'F3' })).toBe('0A F3')
  })
})
