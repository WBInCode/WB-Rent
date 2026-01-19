import { useForm, type UseFormProps, type FieldValues, type DefaultValues } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { type ZodSchema } from 'zod';

interface UseZodFormProps<T extends FieldValues> extends Omit<UseFormProps<T>, 'resolver'> {
  schema: ZodSchema<T>;
}

export function useZodForm<T extends FieldValues>({ 
  schema, 
  defaultValues,
  ...props 
}: UseZodFormProps<T>) {
  return useForm<T>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues as DefaultValues<T>,
    mode: 'onBlur',
    ...props,
  });
}
