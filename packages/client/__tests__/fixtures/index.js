// @flow

import {readFileSync} from 'fs';
import {join} from 'path';

import {Frame} from 'swarm-ron';
import type {Connection as IConn} from '../../src';

export class Connection implements IConn {
  fixtures: Array<RawFrame>;
  session: Array<RawFrame>;
  onmessage: (ev: MessageEvent) => any;

  constructor(fixtures: string) {
    this.fixtures = [];
    this.session = [];
    const content = readFileSync(join(__dirname, fixtures), 'utf8');
    for (const chunk of content.split('.')) {
      if (!chunk.trim()) continue;
      const frame = new Frame(chunk + '.');
      for (const op of frame) {
        if (op.isComment()) {
          this.fixtures.push(new RawFrame(frame.body.slice(op.source.length), op.value(0)));
        } else {
          throw new Error('unexpected op');
        }
        break;
      }
    }
    this.pushPending();
  }

  dump(): {fixtures: Array<RawFrame>, session: Array<RawFrame>} {
    return {
      fixtures: this.fixtures,
      session: this.session,
    };
  }

  send(payload: string): void {
    this.session.push(new RawFrame(payload, '>'));
    this.pushPending();
  }

  pushPending(): void {
    let i = 0;
    for (const raw of this.fixtures.slice(this.session.length)) {
      i++;
      if (raw.direction === '<') {
        (raw => {
          this.session.push(raw);
          setTimeout(() => {
            this.onmessage((({data: raw.body}: any): MessageEvent));
          }, 100 << i);
        })(raw);
      } else break;
    }
  }


}

test('connection', () => {
  const conn = new Connection('handshake.ron');
  const dump = conn.dump();
  expect(JSON.stringify(dump.fixtures)).toBe(
    '[{"body":"*db #test @0+user :0 ?  :password\'12345\'.","direction":">"},{"body":"*db #test$server @1ABC+user :1ABC+server !.","direction":"<"},{"body":"#object?.","direction":">"},{"body":"*lww #object @time+author !  :key \' value\'.","direction":"<"}]',
  );
  expect(dump.fixtures[0].direction).toBe('>');
});

class RawFrame {
  direction: string;
  body: string;

  constructor(body: string, direction: string) {
    this.body = body;
    this.direction = direction;
  }

  toString(): string {
    return this.body;
  }
}
