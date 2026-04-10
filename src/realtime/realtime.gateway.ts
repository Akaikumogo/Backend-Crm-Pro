import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Repository } from 'typeorm';
import { AccessService } from '../access/access.service';
import { UserRole } from '../user-role.enum';
import { User } from '../entities/user.entity';
import { Server, Socket } from 'socket.io';

export type PresenceViewer = {
  userId: string;
  fullName: string | null;
  phase: string;
};

type CrmSocketData = {
  branchId?: string;
  userId?: string;
  fullName?: string | null;
};

function sockData(client: Socket): CrmSocketData {
  return client.data as CrmSocketData;
}

@WebSocketGateway({
  cors: { origin: true, credentials: true },
  namespace: '/realtime',
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(RealtimeGateway.name);

  /** branchId -> apartmentId -> userId -> viewer */
  private readonly presence = new Map<
    string,
    Map<string, Map<string, PresenceViewer>>
  >();

  private readonly socketMeta = new Map<
    string,
    { branchId: string; apartmentId: string; userId: string }
  >();

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly access: AccessService,
    private readonly jwt: JwtService,
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  async handleConnection(client: Socket) {
    const branchIdRaw =
      typeof client.handshake.query.branchId === 'string'
        ? client.handshake.query.branchId
        : undefined;
    if (!branchIdRaw) {
      this.logger.warn('Socket disconnected: missing branchId');
      client.disconnect(true);
      return;
    }

    const token =
      (typeof client.handshake.auth === 'object' &&
        client.handshake.auth !== null &&
        typeof (client.handshake.auth as { token?: string }).token ===
          'string' &&
        (client.handshake.auth as { token: string }).token) ||
      (typeof client.handshake.query.token === 'string'
        ? client.handshake.query.token
        : undefined);

    if (token) {
      try {
        const decoded = await this.jwt.verifyAsync<{
          sub: string;
          role: UserRole;
          organizationId: string | null;
          branchId: string | null;
        }>(token);
        const actor = {
          sub: decoded.sub,
          role: decoded.role,
          organizationId: decoded.organizationId ?? null,
          branchId: decoded.branchId ?? null,
        };
        await this.access.assertBranchRead(actor, branchIdRaw);
        const u = await this.users.findOne({
          where: { id: decoded.sub },
          select: { id: true, fullName: true },
        });
        const d = sockData(client);
        d.branchId = branchIdRaw;
        d.userId = decoded.sub;
        d.fullName = u?.fullName ?? null;
      } catch (e) {
        this.logger.warn(`JWT socket auth failed: ${e}`);
        client.disconnect(true);
        return;
      }
    } else {
      try {
        await this.access.ensurePublicBranch(branchIdRaw);
      } catch {
        client.disconnect(true);
        return;
      }
      sockData(client).branchId = branchIdRaw;
    }

    const room = RealtimeGateway.branchRoom(branchIdRaw);
    await client.join(room);
    this.logger.debug(`Client ${client.id} joined ${room}`);
  }

  handleDisconnect(client: Socket) {
    const meta = this.socketMeta.get(client.id);
    if (meta) {
      this.removePresence(meta.branchId, meta.apartmentId, meta.userId);
      this.socketMeta.delete(client.id);
    }
  }

  @SubscribeMessage('apartment.enter')
  onApartmentEnter(
    client: Socket,
    payload: { apartmentId?: string; phase?: string },
  ) {
    const d = sockData(client);
    const userId = d.userId;
    const branchId = d.branchId;
    const fullName = d.fullName ?? null;
    if (!userId || !branchId || !payload?.apartmentId) {
      return { ok: false, error: 'auth_or_payload' };
    }
    const prev = this.socketMeta.get(client.id);
    if (
      prev &&
      (prev.apartmentId !== payload.apartmentId || prev.branchId !== branchId)
    ) {
      this.removePresence(prev.branchId, prev.apartmentId, prev.userId);
    }
    const phase = payload.phase === 'editing' ? 'editing' : 'viewing';
    this.setPresence(branchId, payload.apartmentId, userId, {
      userId,
      fullName,
      phase,
    });
    this.socketMeta.set(client.id, {
      branchId,
      apartmentId: payload.apartmentId,
      userId,
    });
    return { ok: true };
  }

  @SubscribeMessage('apartment.leave')
  onApartmentLeave(client: Socket, payload: { apartmentId?: string }) {
    const d = sockData(client);
    const userId = d.userId;
    const branchId = d.branchId;
    if (!userId || !branchId || !payload?.apartmentId) {
      return { ok: false };
    }
    this.removePresence(branchId, payload.apartmentId, userId);
    this.socketMeta.delete(client.id);
    return { ok: true };
  }

  private setPresence(
    branchId: string,
    apartmentId: string,
    userId: string,
    viewer: PresenceViewer,
  ) {
    if (!this.presence.has(branchId)) {
      this.presence.set(branchId, new Map());
    }
    const byApt = this.presence.get(branchId)!;
    if (!byApt.has(apartmentId)) {
      byApt.set(apartmentId, new Map());
    }
    byApt.get(apartmentId)!.set(userId, viewer);
    this.emitPresence(branchId, apartmentId);
  }

  private removePresence(
    branchId: string,
    apartmentId: string,
    userId: string,
  ) {
    const byApt = this.presence.get(branchId);
    const viewers = byApt?.get(apartmentId);
    if (!viewers) {
      return;
    }
    viewers.delete(userId);
    this.emitPresence(branchId, apartmentId);
  }

  private emitPresence(branchId: string, apartmentId: string) {
    const viewers = this.presence.get(branchId)?.get(apartmentId);
    const list = viewers ? [...viewers.values()] : [];
    this.server
      .to(RealtimeGateway.branchRoom(branchId))
      .emit('apartment.presence', { apartmentId, viewers: list });
  }

  static branchRoom(branchId: string) {
    return `branch:${branchId}`;
  }

  emitApartmentUpdated(
    branchId: string,
    payload: { apartmentId: string; status: string },
  ) {
    this.server
      .to(RealtimeGateway.branchRoom(branchId))
      .emit('apartment.updated', payload);
  }
}
