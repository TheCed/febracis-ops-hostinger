import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, requireAnyPermission, requirePermission, writeAudit } from '../middleware/auth.js'
import {
  getSheetSettings,
  getSyncRun,
  listSyncRuns,
  runSheetSync,
  saveSheetSettings,
  testSheetsConnection,
} from '../services/googleSheets/syncService.js'
import { DEFAULT_MAPPINGS } from '../services/googleSheets/normalizer.js'

export function googleSheetsRoutes() {
  const router = Router()
  router.use(requireAuth)

  router.get('/status', requireAnyPermission('sheets.sync', 'settings.view'), (_req, res) => {
    const settings = getSheetSettings()
    const runs = listSyncRuns(1)
    res.json({
      settings,
      lastRun: runs[0]
        ? {
            id: runs[0].id,
            status: runs[0].status,
            mode: runs[0].mode,
            startedAt: runs[0].started_at,
            finishedAt: runs[0].finished_at,
            created: runs[0].created_count,
            updated: runs[0].updated_count,
            conflicts: runs[0].conflict_count,
            errors: runs[0].error_count,
          }
        : null,
      defaultMappings: DEFAULT_MAPPINGS,
    })
  })

  router.put('/config', requirePermission('settings.edit'), (req, res) => {
    const schema = z.object({
      enabled: z.boolean().optional(),
      spreadsheetId: z.string().optional(),
      sheetName: z.string().optional(),
      headerRow: z.number().int().positive().optional(),
      idHeader: z.string().optional(),
      mappings: z
        .array(
          z.object({
            crmField: z.string(),
            sheetHeader: z.string(),
            required: z.boolean().optional(),
            transform: z
              .enum([
                'trim',
                'name',
                'phone',
                'email',
                'date',
                'boolean',
                'status',
                'presence',
                'none',
              ])
              .optional(),
          }),
        )
        .optional(),
    })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_payload' })
      return
    }
    const settings = saveSheetSettings(parsed.data)
    writeAudit('sheets.config_update', { userId: req.user?.id, ip: req.ip })
    res.json(settings)
  })

  router.post('/test', requirePermission('sheets.sync'), async (_req, res) => {
    res.json(await testSheetsConnection())
  })

  router.post('/preview', requirePermission('sheets.sync'), async (req, res) => {
    const result = await runSheetSync({ dryRun: true, userId: req.user?.id })
    writeAudit('sheets.preview', { userId: req.user?.id, meta: { runId: result.runId }, ip: req.ip })
    res.json(result)
  })

  router.post('/sync', requirePermission('sheets.sync'), async (req, res) => {
    const result = await runSheetSync({ dryRun: false, userId: req.user?.id })
    writeAudit('sheets.sync', { userId: req.user?.id, meta: { runId: result.runId }, ip: req.ip })
    res.json(result)
  })

  router.get('/history', requirePermission('sheets.sync'), (_req, res) => {
    res.json(
      listSyncRuns(50).map((r) => ({
        id: r.id,
        source: r.source,
        mode: r.mode,
        status: r.status,
        startedAt: r.started_at,
        finishedAt: r.finished_at,
        read: r.read_count,
        created: r.created_count,
        updated: r.updated_count,
        unchanged: r.unchanged_count,
        skipped: r.skipped_count,
        conflicts: r.conflict_count,
        errors: r.error_count,
        userId: r.user_id,
      })),
    )
  })

  router.get('/history/:id', requirePermission('sheets.sync'), (req, res) => {
    const data = getSyncRun(req.params.id)
    if (!data) {
      res.status(404).json({ error: 'not_found' })
      return
    }
    res.json(data)
  })

  return router
}
