import { AuditAction, AuditEntity } from "@prisma/client";
import { prisma } from "../db";

type AuditInput = {
  userId?: string | null;
  action: AuditAction;
  entity: AuditEntity;
  entityId?: string | null;
  description?: string;
  oldValue?: object | null;
  newValue?: object | null;
  metadata?: object | null;
};

export async function logAudit(input: AuditInput) {
  return prisma.auditLog.create({
    data: {
      userId: input.userId ?? null,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
      description: input.description,
      oldValue: input.oldValue as object | undefined,
      newValue: input.newValue as object | undefined,
      metadata: input.metadata as object | undefined,
    },
  });
}
