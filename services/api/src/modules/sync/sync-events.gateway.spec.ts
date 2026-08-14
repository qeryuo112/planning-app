import { Test, TestingModule } from "@nestjs/testing";
import { JwtService } from "@nestjs/jwt";
import { SyncEventsGateway } from "./sync-events.gateway";

const mockJwtService = {
  verify: jest.fn(),
};

describe("SyncEventsGateway", () => {
  let gateway: SyncEventsGateway;
  let mockServer: { to: jest.Mock; emit: jest.Mock };

  beforeEach(async () => {
    mockServer = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SyncEventsGateway,
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    gateway = module.get<SyncEventsGateway>(SyncEventsGateway);
    gateway.server = mockServer as any;
    jest.clearAllMocks();
  });

  describe("handleConnection", () => {
    it("should auto-authenticate when token is provided in handshake query", () => {
      const client = {
        id: "socket-3",
        handshake: { query: { token: "query-token" } },
        join: jest.fn(),
        emit: jest.fn(),
      };

      mockJwtService.verify.mockReturnValue({
        sub: "u2",
        email: "u2@test.com",
      });

      gateway.handleConnection(client as any);

      expect(mockJwtService.verify).toHaveBeenCalledWith("query-token");
      expect(client.join).toHaveBeenCalledWith("user:u2");
      expect(client.emit).toHaveBeenCalledWith("auth_ok", { userId: "u2" });
    });

    it("should do nothing when no token is provided in handshake query", () => {
      const client = {
        id: "socket-4",
        handshake: { query: {} },
        join: jest.fn(),
        emit: jest.fn(),
      };

      gateway.handleConnection(client as any);

      expect(mockJwtService.verify).not.toHaveBeenCalled();
      expect(client.join).not.toHaveBeenCalled();
    });
  });

  describe("handleAuth", () => {
    it("should join user room and emit auth_ok when token is valid", () => {
      const client = {
        id: "socket-1",
        join: jest.fn(),
        emit: jest.fn(),
      };

      mockJwtService.verify.mockReturnValue({
        sub: "u1",
        email: "u1@test.com",
      });

      gateway.handleAuth(client as any, "valid-token");

      expect(mockJwtService.verify).toHaveBeenCalledWith("valid-token");
      expect(client.join).toHaveBeenCalledWith("user:u1");
      expect(client.emit).toHaveBeenCalledWith("auth_ok", { userId: "u1" });
    });

    it("should emit auth_error when token is invalid", () => {
      const client = {
        id: "socket-2",
        join: jest.fn(),
        emit: jest.fn(),
      };

      mockJwtService.verify.mockImplementation(() => {
        throw new Error("invalid token");
      });

      gateway.handleAuth(client as any, "bad-token");

      expect(client.join).not.toHaveBeenCalled();
      expect(client.emit).toHaveBeenCalledWith(
        "auth_error",
        expect.objectContaining({ message: "无效 token" }),
      );
    });
  });

  describe("broadcastToUser", () => {
    it("should emit sync_event to the user room", () => {
      const payload = { eventType: "task.created", targetId: "t1" };

      gateway.broadcastToUser("u1", payload);

      expect(mockServer.to).toHaveBeenCalledWith("user:u1");
      expect(mockServer.emit).toHaveBeenCalledWith("sync_event", payload);
    });
  });
});
