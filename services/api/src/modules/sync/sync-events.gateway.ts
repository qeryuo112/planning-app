import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";

interface JwtPayload {
  sub: string;
  email: string;
}

/**
 * 同步事件 WebSocket 网关
 * 客户端连接后通过 auth 消息发送 JWT，服务端按 userId 加入房间并广播事件。
 */
@WebSocketGateway({
  namespace: "sync",
  cors: { origin: "*" },
})
export class SyncEventsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(SyncEventsGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(private readonly jwtService: JwtService) {}

  handleConnection(client: Socket) {
    this.logger.debug(`客户端连接: ${client.id}`);
    const token = client.handshake.query.token as string | undefined;
    if (token) {
      this.authenticate(client, token);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`客户端断开: ${client.id}`);
  }

  @SubscribeMessage("auth")
  handleAuth(client: Socket, token: string) {
    this.authenticate(client, token);
  }

  private authenticate(client: Socket, token: string) {
    try {
      const payload = this.jwtService.verify<JwtPayload>(token);
      this.joinUserRoom(client, payload.sub);
      client.emit("auth_ok", { userId: payload.sub });
    } catch (err) {
      this.logger.warn(`客户端 ${client.id} 鉴权失败: ${err.message}`);
      client.emit("auth_error", { message: "无效 token" });
    }
  }

  /**
   * 客户端发送 auth 消息后，加入按 userId 命名的房间。
   */
  joinUserRoom(client: Socket, userId: string) {
    this.logger.debug(`客户端 ${client.id} 加入房间 ${userId}`);
    client.join(`user:${userId}`);
  }

  broadcastToUser(userId: string, payload: Record<string, unknown>) {
    this.logger.debug(`广播事件到房间 user:${userId}`);
    this.server.to(`user:${userId}`).emit("sync_event", payload);
  }
}
