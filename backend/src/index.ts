import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import { config } from './config.js'
import { errorHandler } from './middleware/errorHandler.js'
import healthRouter from './routes/health.js'
import authRouter from './routes/auth.js'
import locationsRouter from './routes/locations.js'
import unitsRouter from './routes/units.js'
import guestsRouter from './routes/guests.js'
import reservationsRouter from './routes/reservations.js'
import calendarRouter from './routes/calendar.js'
import dashboardRouter from './routes/dashboard.js'
import staffRouter from './routes/staff.js'
import notificationsRouter from './routes/notifications.js'
import auditLogsRouter from './routes/audit-logs.js'
import pricingRouter from './routes/pricing.js'
import facilitiesRouter from './routes/facilities.js'
import discountsRouter from './routes/discounts.js'
import loyaltyRouter from './routes/loyalty.js'
import servicesRouter from './routes/services.js'
import paymentsRouter from './routes/payments.js'
import roomBlocksRouter from './routes/room-blocks.js'
import adminRouter from './routes/admin.js'
import inventoryRouter from './routes/inventory.js'
import reportsRouter from './routes/reports.js'
import activityRouter from './routes/activity.js'
import attachmentsRouter from './routes/attachments.js'
import storageRouter from './routes/storage.js'

const app = express()

app.use(helmet())
app.use(
  cors({
    origin: config.corsOrigins,
    credentials: true,
  })
)
app.use(express.json())
app.use(cookieParser())

app.use('/health', healthRouter)
app.use('/auth', authRouter)
app.use('/locations', locationsRouter)
app.use('/units', unitsRouter)
app.use('/guests', guestsRouter)
app.use('/reservations', reservationsRouter)
app.use('/calendar', calendarRouter)
app.use('/dashboard', dashboardRouter)
app.use('/staff', staffRouter)
app.use('/notifications', notificationsRouter)
app.use('/audit-logs', auditLogsRouter)
app.use('/pricing', pricingRouter)
app.use('/facilities', facilitiesRouter)
app.use('/discounts', discountsRouter)
app.use('/loyalty', loyaltyRouter)
app.use('/services', servicesRouter)
app.use('/payments', paymentsRouter)
app.use('/room-blocks', roomBlocksRouter)
app.use('/admin', adminRouter)
app.use('/inventory', inventoryRouter)
app.use('/reports', reportsRouter)
app.use('/activity', activityRouter)
app.use('/attachments', attachmentsRouter)
app.use('/storage', storageRouter)

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' })
})

app.use(errorHandler)

app.listen(config.port, () => {
  console.log(`[api] Artillery ERP API listening on http://localhost:${config.port}`)
})
