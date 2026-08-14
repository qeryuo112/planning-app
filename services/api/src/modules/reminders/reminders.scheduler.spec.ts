import { Test, TestingModule } from "@nestjs/testing";
import { RemindersScheduler } from "./reminders.scheduler";
import { RemindersService } from "./reminders.service";

const mockRemindersService = {
  processDueReminders: jest.fn(),
};

describe("RemindersScheduler", () => {
  let scheduler: RemindersScheduler;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RemindersScheduler,
        { provide: RemindersService, useValue: mockRemindersService },
      ],
    }).compile();

    scheduler = module.get<RemindersScheduler>(RemindersScheduler);
    jest.clearAllMocks();
  });

  describe("handleDueReminders", () => {
    it("should process due reminders", async () => {
      mockRemindersService.processDueReminders.mockResolvedValue({
        processed: 2,
      });

      await scheduler.handleDueReminders();

      expect(mockRemindersService.processDueReminders).toHaveBeenCalled();
    });

    it("should not throw when service fails", async () => {
      mockRemindersService.processDueReminders.mockRejectedValue(
        new Error("boom"),
      );

      await expect(scheduler.handleDueReminders()).resolves.toBeUndefined();
    });
  });
});
