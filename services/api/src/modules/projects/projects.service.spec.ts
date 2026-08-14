import { Test, TestingModule } from "@nestjs/testing";
import { PrismaClient } from "@prisma/client";
import { ProjectsService } from "./projects.service";

const mockPrisma = {
  project: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  goal: {
    findFirst: jest.fn(),
  },
};

describe("ProjectsService", () => {
  let service: ProjectsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        { provide: PrismaClient, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("should create a project with optional goal", async () => {
      mockPrisma.goal.findFirst.mockResolvedValue({ id: "g1" });
      mockPrisma.project.create.mockResolvedValue({ id: "p1", title: "项目" });

      const result = await service.create("u1", {
        title: "项目",
        goalId: "g1",
      });

      expect(result.id).toEqual("p1");
      expect(mockPrisma.goal.findFirst).toHaveBeenCalled();
      expect(mockPrisma.project.create).toHaveBeenCalled();
    });
  });

  describe("findAll", () => {
    it("should return user projects", async () => {
      mockPrisma.project.findMany.mockResolvedValue([{ id: "p1" }]);

      const result = await service.findAll("u1");

      expect(result).toHaveLength(1);
      expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: "u1" } }),
      );
    });
  });

  describe("update", () => {
    it("should update project title", async () => {
      mockPrisma.project.findFirst.mockResolvedValue({ id: "p1" });
      mockPrisma.project.update.mockResolvedValue({
        id: "p1",
        title: "新标题",
      });

      const result = await service.update("u1", "p1", { title: "新标题" });

      expect(result.title).toEqual("新标题");
      expect(mockPrisma.project.update).toHaveBeenCalled();
    });
  });
});
