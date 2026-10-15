import type { CreateLinkEventRequest } from '@opulus/core/dto';
import { useMutation } from '@tanstack/react-query';

import { apiClient } from '@/lib/api/client';

/**
 * Report a Plaid Link event to the backend so it is kept. Link runs in the
 * browser, so this is how its events and the ids Plaid support asks for reach
 * us.
 *
 * Fire and forget: a failure to report must never affect the connect flow, so
 * errors are dropped.
 */
export function useLogLinkEvent() {
  return useMutation<void, Error, CreateLinkEventRequest>({
    mutationFn: async (event) => {
      await apiClient.post('/api/link-events', event);
    },
    onError: () => {},
  });
}
