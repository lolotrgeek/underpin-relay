import { Request, Response } from 'express'
import nodeManager from './node-manager'
import db from './db'

/**
 * POST /api/connect
 */
export const connect = async (req: Request, res: Response) => {
  const { host, cert, macaroon } = req.body
  const { token, pubkey } = await nodeManager.connect(host, cert, macaroon)
  await db.addNode({ host, cert, macaroon, token, pubkey })
  res.send({ token })
}

/**
 * GET /api/info
 */
export const getInfo = async (req: Request, res: Response) => {
  const { token } = req.body
  if (!token) throw new Error('Your node is not connected!')
  // find the node that's making the request
  const node = db.getNodeByToken(token)
  if (!node) throw new Error('Node not found with this token')

  // get the node's pubkey and alias
  const rpc = nodeManager.getRpc(node.token)
  const { alias, identityPubkey: pubkey } = await rpc.getInfo()
  const { balance } = await rpc.channelBalance()
  res.send({ alias, balance, pubkey })
}

/**
 * GET /api/actors
 */
export const getActors = (req: Request, res: Response) => {
  const actors = db.getAllActors()
  res.send(actors)
}

/**
 * POST /api/actors
 */
export const createActor = async (req: Request, res: Response) => {
  const { token, name } = req.body
  const rpc = nodeManager.getRpc(token)

  const { alias, identityPubkey: pubkey } = await rpc.getInfo()
  // lnd requires the message to sign to be base64 encoded
  const msg = Buffer.from(name).toString('base64')
  // sign the message to obtain a signature
  const { signature } = await rpc.signMessage({ msg })

  const actor = await db.createActor(alias, name, signature, pubkey)
  res.status(201).send(actor)
}

/**
 * POST /api/actors/:id/impact
 */
export const assignImpact = async (req: Request, res: Response) => {
  const { id } = req.params
  const { hash } = req.body

  // validate that a invoice hash was provided
  if (!hash) throw new Error('hash is required')
  // find the actor
  const actor = db.getActorById(parseInt(id))
  if (!actor) throw new Error('Actor not found')
  // find the node that made this actor
  const node = db.getNodeByPubkey(actor.pubkey)
  if (!node) throw new Error('Node not found for this actor')

  const rpc = nodeManager.getRpc(node.token)
  const rHash = Buffer.from(hash, 'base64')
  const { settled } = await rpc.lookupInvoice({ rHash })
  if (!settled) {
    throw new Error('The payment has not been paid yet!')
  }

  //TRACE: assign the impact to the actor...
  db.assignImpact(actor.id)
  res.send(actor)
}

/**
 * POST /api/actors/:id/verify
 */
export const verifyActor = async (req: Request, res: Response) => {
  const { id } = req.params
  const { token } = req.body
  // find the actor
  const actor = db.getActorById(parseInt(id))
  if (!actor) throw new Error('Actor not found')
  // find the node that's verifying this actor
  const verifyingNode = db.getNodeByToken(token)
  if (!verifyingNode) throw new Error('Your node not found. Try reconnecting.')

  if (actor.pubkey === verifyingNode.pubkey)
    throw new Error('You cannot verify your own actors!')

  const rpc = nodeManager.getRpc(verifyingNode.token)
  const msg = Buffer.from(actor.name).toString('base64')
  const { signature } = actor
  const { pubkey, valid } = await rpc.verifyMessage({ msg, signature })

  if (!valid || pubkey !== actor.pubkey) {
    throw new Error('Verification failed! The signature is invalid.')
  }

  db.verifyActor(actor.id)
  res.send(actor)
}

/**
 * POST /api/actors/:id/invoice
 */
export const actorInvoice = async (req: Request, res: Response) => {
  const { id } = req.params
  // find the actor
  const actor = db.getActorById(parseInt(id))
  if (!actor) throw new Error('Actor not found')
  // find the node that made this actor
  const node = db.getNodeByPubkey(actor.pubkey)
  if (!node) throw new Error('Node not found for this actor')

  // create an invoice on the actorer's node
  const rpc = nodeManager.getRpc(node.token)
  const amount = 100
  const inv = await rpc.addInvoice({ value: amount.toString() })
  res.send({
    payreq: inv.paymentRequest,
    hash: (inv.rHash as Buffer).toString('base64'),
    amount,
  })
}
