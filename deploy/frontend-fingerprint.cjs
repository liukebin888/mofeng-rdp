#!/usr/bin/env node
/**
 * 前端静态资源指纹判定 —— 单一权威（规格治理铁律 1：判定逻辑与控制点评估两处同源）
 *
 * 消费方：
 *   - deploy/rollback-drill.cjs          → assertDistinct()（演练控制点，fail-closed）
 *   - deploy/frontend-fingerprint-selftest.cjs → computeDelta()/assertDistinct()（回退验证）
 *
 * 禁止在任一消费方另写一套 !== 比较；新增规则必须先过 selftest 的死/活样本。
 */
'use strict'

/**
 * 计算两个前端指纹的差异。
 * @param {{ok:boolean,indexSha256?:string,assetPath?:string,assetSha256?:string}} a v2 指纹
 * @param {{ok:boolean,indexSha256?:string,assetPath?:string,assetSha256?:string}} b v1 指纹
 * @returns {{valid:boolean,indexDiff:boolean,assetPathDiff:boolean,assetShaDiff:boolean,distinct:boolean}}
 */
function computeDelta(a, b) {
  const valid = !!(a && b && a.ok && b.ok && a.assetSha256 && b.assetSha256)
  const indexDiff = valid ? a.indexSha256 !== b.indexSha256 : false
  const assetPathDiff = valid ? a.assetPath !== b.assetPath : false
  const assetShaDiff = valid ? a.assetSha256 !== b.assetSha256 : false
  // fail-closed：无效样本永远 distinct=false；任一维度真实不同即判定为不同版本
  const distinct = valid && (assetShaDiff || assetPathDiff || indexDiff)
  return { valid, indexDiff, assetPathDiff, assetShaDiff, distinct }
}

/** 演练控制点：无效样本或零差异一律抛错，绝不产出「看起来通过」的空证据 */
function assertDistinct(a, b) {
  const d = computeDelta(a, b)
  if (!d.valid) throw new Error('前端指纹缺失或采集失败（fail-closed）')
  if (!d.distinct) throw new Error('v2/v1 前端静态资源指纹完全相同，前端未真实参与版本回滚（拒绝零差异假阳性）')
  return d
}

module.exports = { computeDelta, assertDistinct }
