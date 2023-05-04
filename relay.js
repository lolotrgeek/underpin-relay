import { createLibp2p } from 'libp2p'
import { webRTCDirect } from '@libp2p/webrtc-direct'
import { mplex } from '@libp2p/mplex'
import { noise } from '@chainsafe/libp2p-noise'
import wrtc from 'wrtc'
import { webSockets } from '@libp2p/websockets'
import { webRTCStar } from '@libp2p/webrtc-star'
import { tcp } from '@libp2p/tcp'
import { gossipsub } from '@chainsafe/libp2p-gossipsub'
import { bootstrap } from '@libp2p/bootstrap'
import { createEd25519PeerId } from '@libp2p/peer-id-factory'
import { pubsubPeerDiscovery } from '@libp2p/pubsub-peer-discovery'
import getPort from 'get-port';
import * as IPFS from 'ipfs'
import Log from 'ipfs-log'
import IdentityProvider from 'orbit-db-identity-provider'
import { randomUUID } from 'crypto'
import { decodeMessage } from './utils.js'

export async function relay() {
  const wrtcStar = webRTCStar()
  // hardcoded peer id to avoid copy-pasting of listener's peer id into the dialer's bootstrap list
  // generated with cmd `peer-id --type=ed25519`
  const bootstrapPeerID = "12D3KooWCuo3MdXfMgaqpLC5Houi1TRoFqgK9aoxok4NK5udMu8m"
  const bootstrapNode = [`/ip4/127.0.0.1/tcp/9090/http/p2p-webrtc-direct/p2p/${bootstrapPeerID}`]
  let peerID = await createEd25519PeerId()
  let port = await getPort()

  const libp2pBundle = async () => await createLibp2p({
    peerId: peerID,
    addresses: {
      listen: [
        `/ip4/127.0.0.1/tcp/${port}/http/p2p-webrtc-direct`,
        '/ip4/0.0.0.0/tcp/0',
        `/ip4/127.0.0.1/tcp/${port}/ws`,
        // "/dns4/localhost/tcp/24642/ws/p2p-webrtc-star/"
      ]
    },
    pubsub: gossipsub({ allowPublishToZeroPeers: true, emitSelf: false }),
    transports: [webRTCDirect({ wrtc }), webSockets(), tcp(), wrtcStar.transport],
    streamMuxers: [mplex()],
    connectionEncryption: [noise()],
    peerDiscovery: [
      wrtcStar.discovery,
      pubsubPeerDiscovery({ interval: 1000 }),
      bootstrap({ list: bootstrapNode })
    ],
  })
  const ipfs = await IPFS.create({
    repo: "relay" + Math.random(),
    libp2p: libp2pBundle,
    start: false,
    config: { Addresses: { Delegates: [], Bootstrap: [] }, Bootstrap: [] },
  })

  const identity = await IdentityProvider.createIdentity({ id: randomUUID() })
  const log = new Log(ipfs, identity, { logId: "relay"})
  
  await ipfs.start()

  // https://github.com/libp2p/js-libp2p/tree/master/examples/pubsub
  ipfs.pubsub.subscribe('msg', async evt => {
    let msg = decodeMessage(evt.data)
    if(msg.hash && msg.payload) {
      await log.append(msg)
    }
  })

  const update = async () => {
    try {
      console.clear()
      const peers = await ipfs.swarm.addrs()
      console.log('Our peer id:', peerID.toString())
      console.log(`The node now has ${peers.length} peers.`)
      console.log('Peers:', peers.map(p => p.id ? p.id : Object.keys(p)))
      // await log.append({actor: 'dd7f7a1f-f735-4d10-b70e-79dadc8d9857', impact: 0.1, action: 1, state: 1})
      let block = log.values.map((e) => e.payload)[log.values.length - 1]
      console.log('Last block:', block)
    } catch (error) {
      console.log(error)
    }

  }
  setInterval(update, 2000)
}
