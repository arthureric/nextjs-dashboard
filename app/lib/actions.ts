'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import postgres from 'postgres';

const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

// -----------------------------
// Schema
// -----------------------------
const FormSchema = z.object({
  id: z.string(),
  customerId: z.string({
    invalid_type_error: 'Please select a customer.',
  }),
  amount: z.coerce
    .number()
    .gt(0, { message: 'Please enter an amount greater than $0.' }),
  status: z.enum(['pending', 'paid'], {
    invalid_type_error: 'Please select an invoice status.',
  }),
  date: z.string(),
});

const CreateInvoiceSchema = FormSchema.omit({ id: true, date: true });
const UpdateInvoiceSchema = FormSchema.omit({ id: true, date: true });

// -----------------------------
// Types
// -----------------------------
export type State = {
  errors?: {
    customerId?: string[];
    amount?: string[];
    status?: string[];
  };
  message?: string | null;
};

// -----------------------------
// Action: Create Invoice (for useActionState)
// -----------------------------
export async function createInvoice(
  prevState: State,
  formData: FormData
): Promise<State | void> {
  const validatedFields = CreateInvoiceSchema.safeParse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Missing or invalid fields. Failed to create invoice.',
    };
  }

  const { customerId, amount, status } = validatedFields.data;
  const amountInCents = amount * 100;
  const date = new Date().toISOString().split('T')[0];

  try {
    await sql`
      INSERT INTO invoices (customer_id, amount, status, date)
      VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
    `;
  } catch (error) {
    console.error('Database Error:', error);
    return {
      message: 'Database Error: Failed to create invoice.',
    };
  }

  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}

// -----------------------------
// Action: Update Invoice (for useActionState)
// -----------------------------
export async function updateInvoice(
  id: string,
  prevState: State,
  formData: FormData
): Promise<State | void> {
  const validatedFields = UpdateInvoiceSchema.safeParse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Missing or invalid fields. Failed to update invoice.',
    };
  }

  const { customerId, amount, status } = validatedFields.data;
  const amountInCents = amount * 100;

  try {
    await sql`
      UPDATE invoices
      SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
      WHERE id = ${id}
    `;
  } catch (error) {
    console.error('Database Error:', error);
    return {
      message: 'Database Error: Failed to update invoice.',
    };
  }

  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}

// -----------------------------
// Action: Delete Invoice
// -----------------------------
export async function deleteInvoice(id: string): Promise<void> {
  if (!id) {
    throw new Error('Invoice ID is required to delete.');
  }

  try {
    await sql`
      DELETE FROM invoices
      WHERE id = ${id}
    `;
  } catch (error) {
    console.error('Database Error: Failed to delete invoice.', error);
    throw new Error('Failed to delete invoice.');
  }

  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}
// -----------------------------
// End of File
// -----------------------------