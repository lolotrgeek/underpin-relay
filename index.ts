import cors from 'cors'
import express, { Request, Response } from 'express'
import expressWs from 'express-ws'
import { Actor, SocketEvents } from './src/types'
import nodeManager, { NodeEvents } from './src/node-manager'
import db, { ActorEvents } from './src/db'
import * as routes from './src/routes'

const PORT = 4001


//
// Create Express server
//
const { app } = expressWs(express())
app.use(cors({ origin: 'http://localhost:3000' }))
app.use(express.json())

// simple middleware to grab the token from the header and add
// it to the request's body
app.use((req, res, next) => {
  req.body.token = req.header('X-Token')
  next()
})

/**
 * ExpressJS will hang if an async route handler doesn't catch errors and return a response.
 * To avoid wrapping every handler in try/catch, just call this func on the handler. It will
 * catch any async errors and return
 */
export const catchAsyncErrors = (
  routeHandler: (req: Request, res: Response) => Promise<void> | void,
) => {
  // return a function that wraps the route handler in a try/catch block and
  // sends a response on error
  return async (req: Request, res: Response) => {
    try {
      const promise = routeHandler(req, res)
      // only await promises from async handlers.
      if (promise) await promise
    } catch (err) {
      res.status(400).send({ error: err.message })
    }
  }
}

//
// Configure Routes
//
app.post('/api/connect', catchAsyncErrors(routes.connect))
app.get('/api/info', catchAsyncErrors(routes.getInfo))
app.get('/api/actors', catchAsyncErrors(routes.getActors))
app.post('/api/actors', catchAsyncErrors(routes.createActor))
app.post('/api/actors/:id/invoice', catchAsyncErrors(routes.actorInvoice))
app.post('/api/actors/:id/impact', catchAsyncErrors(routes.assignImpact))
app.post('/api/actors/:id/verify', catchAsyncErrors(routes.verifyActor))

//
// Configure Websocket
//
app.ws('/api/events', ws => {
  // when a websocket connection is made, add listeners for actors and invoices
  const actorsListener = (actors: Actor[]) => {
    const event = { type: SocketEvents.actorUpdated, data: actors }
    ws.send(JSON.stringify(event))
  }

  const paymentsListener = (info: any) => {
    const event = { type: SocketEvents.invoicePaid, data: info }
    ws.send(JSON.stringify(event))
  }

  // add listeners to to send data over the socket
  db.on(ActorEvents.updated, actorsListener)
  nodeManager.on(NodeEvents.invoicePaid, paymentsListener)

  // remove listeners when the socket is closed
  ws.on('close', () => {
    db.off(ActorEvents.updated, actorsListener)
    nodeManager.off(NodeEvents.invoicePaid, paymentsListener)
  })
})

//
// Start Server
//
function startServer(port: number) {
  try {
    console.log('Starting API server...')
    app.listen(port, async () => {
      console.log(`API listening at http://localhost:${port}`)

      // Rehydrate data from the DB file
      await db.restore()
      await nodeManager.reconnectNodes(db.getAllNodes())
    })
  } catch (error) {
    if (error.code === 'EADDRINUSE') {
      console.log(`Port ${port} is in use, trying ${port + 1}`)
      startServer(port + 1)
    }
  }

}

startServer(PORT)
