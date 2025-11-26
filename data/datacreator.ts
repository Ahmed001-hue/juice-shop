/* ──────────────────────────────────────────────────────────────
   IMPORTS (required for this section)
─────────────────────────────────────────────────────────────── */

import crypto from 'crypto'
import path from 'path'
import fs from 'fs/promises'
import axios from 'axios'
import logger from '../lib/logger'
import * as utils from '../lib/utils'
import { SecurityQuestionModel } from '../models/securityQuestion'
import { SecurityAnswerModel } from '../models/securityAnswer'
import { UserModel } from '../models/user'
import { ProductModel } from '../models/product'
import {
  createUsers,
  createChallenges,
  createRandomFakeUsers,
  createProducts,
  createBaskets,
  createBasketItems,
  createAnonymousFeedback,
  createComplaints,
  createRecycleItem,
  createOrders,
  createQuantity,
  createWallet,
  createDeliveryMethods,
  createMemories,
  prepareFilesystem
} from './seed-functions' // <-- adjust to however you manage file structure

import { loadStaticSecurityQuestionsData } from './staticData'

/* ──────────────────────────────────────────────────────────────
   SECURITY HELPERS
─────────────────────────────────────────────────────────────── */

function sanitize(input: string) {
  if (!input) return ''
  return input
    .replace(/[<]/g, '&lt;')
    .replace(/[>]/g, '&gt;')
    .replace(/javascript:/gi, '')
}

function randomInt(min: number, max: number) {
  return crypto.randomInt(min, max + 1)
}

function validateSafeUrl(url: string) {
  const allowed = ['http:', 'https:']
  const parsed = new URL(url)
  if (!allowed.includes(parsed.protocol)) {
    throw new Error(`Unsafe URL protocol: ${parsed.protocol}`)
  }
}

async function safeDownloadToFile(url: string, dest: string) {
  validateSafeUrl(url)
  const res = await axios.get(url, { responseType: 'arraybuffer' })
  await fs.mkdir(path.dirname(dest), { recursive: true })
  await fs.writeFile(dest, Buffer.from(res.data))
}

/* ──────────────────────────────────────────────────────────────
   SECURITY QUESTIONS
─────────────────────────────────────────────────────────────── */

export async function createSecurityQuestions() {
  const questions = await loadStaticSecurityQuestionsData()

  for (const q of questions) {
    try {
      await SecurityQuestionModel.create({
        question: sanitize(q.question)
      })
    } catch (err) {
      logger.error(
        `Could not insert SecurityQuestion "${q.question}": ${utils.getErrorMessage(err)}`
      )
    }
  }
}

/* ──────────────────────────────────────────────────────────────
   SECURITY ANSWERS
─────────────────────────────────────────────────────────────── */

export async function createSecurityAnswer(
  UserId: number,
  SecurityQuestionId: number,
  answer: string
) {
  try {
    await SecurityAnswerModel.create({
      UserId,
      SecurityQuestionId,
      answer: sanitize(answer)
    })
  } catch (err) {
    logger.error(
      `Could not insert SecurityAnswer for User ${UserId}: ${utils.getErrorMessage(err)}`
    )
  }
}

/* ──────────────────────────────────────────────────────────────
   DELETION HELPERS
─────────────────────────────────────────────────────────────── */

export async function deleteUser(userId: number) {
  try {
    await UserModel.destroy({ where: { id: userId } })
  } catch (err) {
    logger.error(
      `Could not soft-delete user ${userId}: ${utils.getErrorMessage(err)}`
    )
  }
}

export async function deleteProduct(productId: number) {
  try {
    await ProductModel.destroy({ where: { id: productId } })
  } catch (err) {
    logger.error(
      `Could not soft-delete product ${productId}: ${utils.getErrorMessage(err)}`
    )
  }
}

/* ──────────────────────────────────────────────────────────────
   EXPORT ALL UTILITY FUNCTIONS
─────────────────────────────────────────────────────────────── */

export {
  sanitize,
  validateSafeUrl,
  safeDownloadToFile,
  randomInt
}

/* ──────────────────────────────────────────────────────────────
   MAIN SEED EXECUTION
─────────────────────────────────────────────────────────────── */

export default async function seed() {
  const creators = [
    createSecurityQuestions,
    createUsers,
    createChallenges,
    createRandomFakeUsers,
    createProducts,
    createBaskets,
    createBasketItems,
    createAnonymousFeedback,
    createComplaints,
    createRecycleItem,
    createOrders,
    createQuantity,
    createWallet,
    createDeliveryMethods,
    createMemories,
    prepareFilesystem
  ]

  for (const creator of creators) {
    try {
      await creator()
      logger.info(`✔ ${creator.name} completed.`)
    } catch (err) {
      logger.error(
        `❌ Seed step "${creator.name}" failed: ${utils.getErrorMessage(err)}`
      )
    }
  }

  logger.info('🎉 Seed completed successfully.')
}
