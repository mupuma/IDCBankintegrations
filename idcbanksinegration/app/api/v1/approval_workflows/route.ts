import { NextRequest, NextResponse } from 'next/server';
import { BANK_CODES } from '@/app/lib/banks';
import { ApprovalError, readWorkflow, saveWorkflow, type ApprovalStage } from '@/app/lib/paymentApprovals';
import { PERMISSIONS } from '@/app/lib/permissions';
import { isAuthError, requirePermission } from '@/app/lib/rbac';
import { ApprovalWorkflow } from '@/app/models/internal/ApprovalWorkflow';
import { User } from '@/app/models/internal/User';

export async function GET(request: NextRequest) {
  const admin = await requirePermission(request, PERMISSIONS.USERS_MANAGE);
  if (isAuthError(admin)) return admin;
  const [workflows, users] = await Promise.all([
    ApprovalWorkflow.findAll({ order: [['scope', 'ASC']] }),
    User.findAll({ attributes: ['id', 'username'], where: { isActive: true }, order: [['username', 'ASC']] }),
  ]);
  return NextResponse.json({ workflows: workflows.map(readWorkflow), users, banks: BANK_CODES });
}

export async function POST(request: NextRequest) {
  const admin = await requirePermission(request, PERMISSIONS.USERS_MANAGE);
  if (isAuthError(admin)) return admin;
  const input = await request.json().catch(() => null);
  const name = typeof input?.name === 'string' ? input.name.trim() : '';
  const bankCode = typeof input?.bankCode === 'string' ? input.bankCode.trim().toUpperCase() : '';
  const sourceBank = typeof input?.sourceBank === 'string' ? input.sourceBank.trim() : '';
  if (!name || name.length > 100 || (bankCode && !BANK_CODES.some(bank => bank === bankCode))
    || (sourceBank && !bankCode) || sourceBank.length > 100 || !Array.isArray(input?.stages)
    || input.stages.length < 1 || input.stages.length > 20) {
    return NextResponse.json({ error: 'Enter a workflow name, valid scope and 1 to 20 stages.' }, { status: 400 });
  }

  const stages: ApprovalStage[] = [];
  for (const item of input.stages) {
    const stageName = typeof item?.name === 'string' ? item.name.trim() : '';
    const ids: unknown[] = Array.isArray(item?.approverIds) ? item.approverIds : [];
    const approverIds = [...new Set(ids.map(id => typeof id === 'number' ? id : NaN))];
    if (!stageName || stageName.length > 100 || approverIds.length > 100
      || approverIds.some(id => !Number.isSafeInteger(id) || id < 1)
      || !Number.isInteger(item?.required) || item.required < 1 || item.required > approverIds.length) {
      return NextResponse.json({ error: 'Each stage needs a name, eligible users and a valid approval count.' }, { status: 400 });
    }
    stages.push({ name: stageName, approverIds, required: item.required });
  }

  try {
    const workflow = await saveWorkflow({ name, bankCode, sourceBank, stages }, admin);
    return NextResponse.json({ workflow }, { status: 201 });
  } catch (error) {
    if (error instanceof ApprovalError) return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
}
