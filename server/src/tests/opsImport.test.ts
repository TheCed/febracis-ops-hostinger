/**
 * Integration-style test for historical import using fixtures.
 */
import assert from 'node:assert/strict'
import { describe, it, before } from 'node:test'
import { migrate, db } from '../lib/db.js'
import { runOpsMigrations } from '../lib/migrations/opsMigrations.js'
import { ensureLegacyCourses } from '../routes/ficha.js'
import { FIXTURE_HISTORICAL_TABS } from '../services/ops/fixtures/historicalTabs.js'
import { runHistoricalImport, type HistoricalSheetTab } from '../services/ops/historicalImport.js'

describe('historicalImport fixtures', () => {
  before(() => {
    migrate()
    runOpsMigrations()
    ensureLegacyCourses()
  })

  it('imports multi-schema tabs with RAW dispositions and is idempotent', () => {
    const tag = `CONFIRMACOES_FIXTURE_${Date.now()}`
    const tabs: HistoricalSheetTab[] = FIXTURE_HISTORICAL_TABS.map((t) => ({
      ...t,
      sourceFile: tag,
    }))

    const first = runHistoricalImport(tabs, {
      spreadsheetId: 'test-fixtures',
      mode: 'apply',
    })
    assert.ok(first.sourceRecords >= 7)
    assert.equal(first.tabsAnalyzed, 3)
    assert.ok(first.schemasDetected >= 2)
    assert.equal(first.imported + first.needsReview + first.ignored, first.sourceRecords)

    const rawCount = (
      db.prepare('SELECT COUNT(*) as c FROM import_raw_rows WHERE run_id = ?').get(first.runId) as {
        c: number
      }
    ).c
    assert.ok(rawCount > 0)

    const second = runHistoricalImport(tabs, {
      spreadsheetId: 'test-fixtures',
      mode: 'apply',
    })
    assert.ok(second.ignored >= first.sourceRecords - 1)
    assert.equal(second.enrollmentsUpserted, 0)
  })
})
