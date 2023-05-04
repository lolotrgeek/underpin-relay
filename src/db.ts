import { EventEmitter } from 'events';
import { existsSync, promises as fs } from 'fs';
import { Actor } from './types';

const DB_FILE = 'db.json';

export interface LndNode {
  token: string;
  host: string;
  cert: string;
  macaroon: string;
  pubkey: string;
}

export interface DbData {
  actors: Actor[];
  nodes: LndNode[];
}

/**
 * The list of events emitted by the ActorsDb
 */
export const ActorEvents = {
  updated: 'actor-updated',
};

/**
 * A very simple file-based DB to store the actors
 */
class ActorsDb extends EventEmitter {
  // in-memory database
  private _data: DbData = {
    actors: [],
    nodes: [],
  };

  //
  // Actors
  //

  getAllActors() {
    return this._data.actors.sort((a, b) => b.impact - a.impact);
  }

  getActorById(id: number) {
    return this.getAllActors().find(actor => actor.id === id);
  }

  async createActor(
    username: string,
    name: string,
    signature: string,
    pubkey: string,
  ) {
    // calculate the highest numeric id
    const maxId = Math.max(0, ...this._data.actors.map(p => p.id));

    const actor: Actor = {
      id: maxId + 1, // TODO: use uuid
      username,
      name,
      impact: 0,
      signature,
      pubkey,
      verified: false,
    };
    this._data.actors.push(actor);

    await this.persist();
    this.emit(ActorEvents.updated, actor);
    return actor;
  }

  async assignImpact(actorId: number) {
    const actor = this._data.actors.find(p => p.id === actorId);
    if (!actor) {
      throw new Error('Actor not found');
    }
    //TODO: calc impact here
    actor.impact++;
    await this.persist();
    this.emit(ActorEvents.updated, actor);
  }

  async verifyActor(actorId: number) {
    const actor = this._data.actors.find(p => p.id === actorId);
    if (!actor) {
      throw new Error('Actor not found');
    }
    actor.verified = true;
    await this.persist();
    this.emit(ActorEvents.updated, actor);
  }

  //
  // Nodes
  //

  getAllNodes() {
    return this._data.nodes;
  }

  getNodeByPubkey(pubkey: string) {
    return this.getAllNodes().find(node => node.pubkey === pubkey);
  }

  getNodeByToken(token: string) {
    return this.getAllNodes().find(node => node.token === token);
  }

  async addNode(node: LndNode) {
    this._data.nodes = [
      // add new node
      node,
      // exclude existing nodes with the same server
      ...this._data.nodes.filter(n => n.host !== node.host),
    ];
    await this.persist();
  }

  //
  // HACK! Persist data to a JSON file to keep it when the server restarts.
  // Do not do this in a production app. This is just for convenience when
  // developing this sample app locally.
  //

  async persist() {
    await fs.writeFile(DB_FILE, JSON.stringify(this._data, null, 2));
  }

  async restore() {
    if (!existsSync(DB_FILE)) return;

    const contents = await fs.readFile(DB_FILE);
    if (contents) {
      this._data = JSON.parse(contents.toString());
      if (!this._data.nodes) this._data.nodes = [];
      console.log(`Loaded ${this._data.actors.length} actors`);
    }
  }
}

export default new ActorsDb();
