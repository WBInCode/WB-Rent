import { useForm, type UseFormProps, type FieldValues, type DefaultValues } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ZodType } from 'zod';

interface UseZodFormProps<T extends FieldValues> extends Omit<UseFormProps<T>, 'resolver'> {
  schema: ZodType<T>;
}

export function useZodForm<T extends FieldValues>({ 
  schema, 
  defaultValues,
  ...props 
}: UseZodFormProps<T>) {
  return useForm<T>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema as any),
    defaultValues: defaultValues as DefaultValues<T>,
    mode: 'onBlur',
    ...props,
  });
}
