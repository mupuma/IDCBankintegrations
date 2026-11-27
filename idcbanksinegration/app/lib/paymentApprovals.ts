import { randomUUID } from 'node:crypto';
import { Op } from 'sequelize';
import { getSequelize } from './db';
import { ApprovalWorkflow } from '../models/internal/ApprovalWorkflow';
import { AuditLog } from '../models/internal/AuditLog';
import { PaymentQueueRequest } from '../models/internal/PaymentQueueRequest';
import { User } from '../models/internal/User';
import { ZicbH2hPayment } from '../models/internal/ZicbH2hPayment';
import type { SessionUser } from './rbac';

export const AWAITING_APPROVAL = 'awaiting_approval';
export const APPROVAL_REJECTED = 'approval_rejected';

export interface ApprovalStage {
  name: string;
  approverIds: number[];
  required: number;
}

export interface WorkflowDefinition {
  version: string;
  name: string;
  bankCode: string;
  sourceBank: string;
  stages: ApprovalStage[];
}

interface Decision {
  stage: number;
  userId: number;
  username: string;
  action: 'approve' | 'reject';
  reason: string;
  at: string;
}

export interface ApprovalSnapshot {
  workflow: WorkflowDefinition;
  creatorId: number;
  stage: number;
  decisions: Decision[];
}

export class ApprovalError extends Error {
  constructor(message: string, public status = 409) { super(message); }
}

export function workflowScope(bankCode: string, sourceBank = '') {
  return bankCode + ':' + sourceBank.toUpperCase();
}

export function readWorkflow(row: ApprovalWorkflow): WorkflowDefinition {
  return JSON.parse(row.definition) as WorkflowDefinition;
}

export function readApproval(row: PaymentQueueRequest): ApprovalSnapshot | null {
  return row.approvalSnapshot ? JSON.parse(row.approvalSnapshot) as ApprovalSnapshot : null;
}

export async function saveWorkflow(input: Omit<WorkflowDefinition, 'version'>, admin: SessionUser) {
  const ids = [...new Set(input.stages.flatMap(stage => stage.approverIds))];
  const db = await getSequelize();
  return db.transaction(async transaction => {
    const count = await User.count({ where: { id: { [Op.in]: ids }, isActive: true }, transaction });
    if (count !== ids.length) throw new ApprovalError('Select active portal users for every stage.', 400);
    const workflow = { ...input, version: randomUUID() };
    const scope = workflowScope(input.bankCode, input.sourceBank);
    await ApprovalWorkflow.upsert({ scope, definition: JSON.stringify(workflow) }, { transaction });
    await AuditLog.create({
      userId: admin.id, username: admin.username, action: 'APPROVAL_WORKFLOW_SAVED',
      resourceType: 'approval_workflow', resourceId: scope, correlationId: workflow.version,
      summary: 'Saved approval workflow ' + workflow.name, details: JSON.stringify(workflow),
      ipAddress: null, userAgent: null,
    }, { transaction });
    return workflow;
  });
}

export async function preparePaymentApproval(bankCode: string, sourceBank: string | null | undefined, creatorId: number) {
  const scopes = [workflowScope(bankCode, sourceBank ?? ''), workflowScope(bankCode), workflowScope('')];
  const rows = await ApprovalWorkflow.findAll({ where: { scope: { [Op.in]: scopes } } });
  const selected = scopes.map(scope => rows.find(row => row.scope.toUpperCase() === scope)).find(Boolean);
  if (!selected) throw new ApprovalError('An administrator must configure an approval workflow for this payment.');
  const workflow = readWorkflow(selected);
  const ids = [...new Set(workflow.stages.flatMap(stage => stage.approverIds))];
  const users = await User.findAll({ attributes: ['id'], where: { id: { [Op.in]: ids }, isActive: true } });
  const activeIds = new Set(users.map(user => Number(user.id)));
  if (workflow.stages.some(stage => stage.approverIds.filter(id =>
    activeIds.has(id) && (workflow.stages.length === 1 || id !== Number(creatorId))).length < stage.required)) {
    throw new ApprovalError('This workflow does not have enough eligible active approvers.');
  }
  const snapshot: ApprovalSnapshot = { workflow, creatorId: Number(creatorId), stage: 0, decisions: [] };
  return { status: AWAITING_APPROVAL, approvalSnapshot: JSON.stringify(snapshot) };
}

export function canDecide(snapshot: ApprovalSnapshot, userId: number) {
  const id = Number(userId);
  return (snapshot.workflow.stages.length === 1 || snapshot.creatorId !== id)
    && snapshot.workflow.stages[snapshot.stage]?.approverIds.includes(id) === true
    && !snapshot.decisions.some(decision => decision.stage === snapshot.stage && decision.userId === id);
}

export async function decidePayment(queueId: string, expectedVersion: string, expectedStage: number, action: Decision['action'], reason: string, user: SessionUser) {
  const original = await PaymentQueueRequest.findOne({ where: { queueId }, attributes: ['bankCode'] });
  if (!original) throw new ApprovalError('Payment not found.', 404);

  const db = await getSequelize();
  return db.transaction(async transaction => {
    // Keep the ledger and queue updates atomic and use the ledger's lock order.
    const ledger = original.bankCode === 'ZICB'
      ? await ZicbH2hPayment.findByPk(queueId, { transaction, lock: transaction.LOCK.UPDATE }) : null;
    const row = await PaymentQueueRequest.findOne({ where: { queueId }, transaction, lock: transaction.LOCK.UPDATE });
    if (!row || row.status !== AWAITING_APPROVAL) throw new ApprovalError('This payment is no longer awaiting approval.');
    const snapshot = readApproval(row);
    if (!snapshot || snapshot.workflow.version !== expectedVersion || snapshot.stage !== expectedStage) throw new ApprovalError('The approval stage changed. Refresh and review the current stage.');
    if (!canDecide(snapshot, user.id)) throw new ApprovalError('You are not eligible to decide at this stage.', 403);
    const stage = snapshot.workflow.stages[snapshot.stage];
    snapshot.decisions.push({
      stage: snapshot.stage, userId: Number(user.id), username: user.username, action, reason, at: new Date().toISOString(),
    });

    if (action === 'reject') row.status = APPROVAL_REJECTED;
    else if (snapshot.decisions.filter(decision => decision.stage === expectedStage && decision.action === 'approve').length >= stage.required) {
      snapshot.stage += 1;
      if (snapshot.stage === snapshot.workflow.stages.length) row.status = 'queued';
    }

    if (JSON.parse(row.paymentPayload)?.h2hProtocol === 'h2h-v1') {
      if (!ledger || ledger.state !== AWAITING_APPROVAL) throw new ApprovalError('The payment ledger is not awaiting approval.');
      if (row.status !== AWAITING_APPROVAL) {
        await ledger.update({ state: row.status, nextRun: row.status === 'queued' ? new Date() : null }, { transaction });
      }
    }

    row.approvalSnapshot = JSON.stringify(snapshot);
    await row.save({ transaction });
    await AuditLog.create({
      userId: user.id, username: user.username, action: action === 'approve' ? 'PAYMENT_APPROVED' : 'PAYMENT_APPROVAL_REJECTED',
      resourceType: 'payment_queue', resourceId: queueId, correlationId: queueId,
      summary: (action === 'approve' ? 'Approved ' : 'Rejected ') + 'payment at stage ' + (expectedStage + 1),
      details: JSON.stringify({ workflowVersion: snapshot.workflow.version, stage: expectedStage + 1, reason, status: row.status }),
      ipAddress: null, userAgent: null,
    }, { transaction });
    return row;
  });
}
