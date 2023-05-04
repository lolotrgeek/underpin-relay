export interface Actor {
  id: number
  name: string
  username: string
  impact: number
  signature: string
  pubkey: string
  verified: boolean
}

export interface State {
  before: number,
  after: number
}

export interface Impact {
  id:string,
  impact: number,
  confidence: {
    lowerBound:number,
    uppderBound:number,
    levelOfConfidence: number
  }
}

export const SocketEvents = {
  actorUpdated: 'actor-updated',
  invoicePaid: 'invoice-paid',
}
