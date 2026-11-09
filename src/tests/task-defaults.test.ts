import { beforeEach, describe, expect, it } from "vitest";
import { buildAuthenticatedContext } from "@/application/auth-service";
import { createOrSaveGuidedDeal } from "@/application/deal-service";
import { updateTaskTemplateSlaAndDefaultAssignee } from "@/application/report-and-admin-service";
import {
  loadDatabaseState,
  saveDatabaseState,
} from "@/infrastructure/database";
import { createInitialSeedState, DEMO_BRANCH_ID } from "./fixtures/seed-data";

process.env.CHAVEFLOW_TEST_IN_MEMORY = "true";
describe("Prazos e responsáveis", () => {
  beforeEach(() => saveDatabaseState(createInitialSeedState()));
  it.each([0, 721, NaN])(
    "recusa prazo inválido %s sem alterar o modelo",
    async (hours) => {
      const ctx = (await buildAuthenticatedContext("user-admin"))!;
      const original = structuredClone(
        (await loadDatabaseState()).taskTemplates[0],
      );
      await expect(
        updateTaskTemplateSlaAndDefaultAssignee({
          ctx,
          taskTemplateId: original.id,
          slaHours: hours,
          defaultAssigneeId: null,
        }),
      ).rejects.toThrow(/1 a 720/);
      expect((await loadDatabaseState()).taskTemplates[0]).toEqual(original);
    },
  );
  it.each(["user-other-org", "user-cliente-helena", "user-vendedor"])(
    "recusa responsável sem acesso à área: %s",
    async (profileId) => {
      const ctx = (await buildAuthenticatedContext("user-admin"))!;
      const original = structuredClone(
        (await loadDatabaseState()).taskTemplates.find(
          (t) => t.code === "TASK_PAYMENT_PROOF",
        )!,
      );
      await expect(
        updateTaskTemplateSlaAndDefaultAssignee({
          ctx,
          taskTemplateId: original.id,
          slaHours: 48,
          defaultAssigneeId: profileId,
        }),
      ).rejects.toThrow(/responsável ativo/);
      expect(
        (await loadDatabaseState()).taskTemplates.find(
          (t) => t.id === original.id,
        ),
      ).toEqual(original);
    },
  );
  it("aplica a mudança em novas negociações e preserva tarefas existentes", async () => {
    const ctx = (await buildAuthenticatedContext("user-admin"))!;
    const db = await loadDatabaseState(),
      previousTasks = structuredClone(db.taskInstances);
    const template = db.taskTemplates.find(
      (t) => t.code === "TASK_PAYMENT_PROOF",
    )!;
    await updateTaskTemplateSlaAndDefaultAssignee({
      ctx,
      taskTemplateId: template.id,
      slaHours: 48,
      defaultAssigneeId: ctx.profile.id,
    });
    expect((await loadDatabaseState()).taskInstances).toEqual(previousTasks);
    const { deal } = await createOrSaveGuidedDeal({
      ctx,
      input: {
        vehicleId: "veh-005",
        branchId: DEMO_BRANCH_ID,
        sellerId: ctx.profile.id,
        customerMode: "EXISTING",
        customerId: "cust-marcelo",
        buyerType: "PF",
        paymentMethod: "CASH",
        hasFinancing: false,
        hasTradeIn: false,
        hasPowerOfAttorney: false,
        saveAsDraft: false,
      },
    });
    const task = (await loadDatabaseState()).taskInstances.find(
      (t) => t.dealId === deal.id && t.code === template.code,
    )!;
    expect(task.assigneeId).toBe(ctx.profile.id);
    expect(
      Math.round(
        (Date.parse(task.dueAt!) - Date.parse(deal.createdAt)) / 3600000,
      ),
    ).toBe(48);
  });
  it("vendedor não altera configurações da rotina", async () => {
    const ctx = (await buildAuthenticatedContext("user-vendedor"))!;
    await expect(
      updateTaskTemplateSlaAndDefaultAssignee({
        ctx,
        taskTemplateId: (await loadDatabaseState()).taskTemplates[0].id,
        slaHours: 24,
        defaultAssigneeId: null,
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});
