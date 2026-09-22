import { ref } from 'vue';

import type { RsvpResponse, SessionDetailDto } from '@futcheck/shared';

import { useDataVersion } from '@/composables/useDataVersion';
import { tapFeedback } from '@/lib/haptics';
import { useToast } from '@/composables/useToast';
import { rsvpSuccessMessage } from '@/lib/rsvpState';
import { normalizeApiError } from '@/services/http';
import { answerSession } from '@/services/sessions';

/**
 * Sends an answer and reports back. The caller replaces its copy of the session
 * with whatever the server returns — the server, not this client, decided the
 * outcome (seat, waitlist position, refusal).
 */
export function useRsvp() {
  const toast = useToast();
  const { markBookingsChanged } = useDataVersion();
  const pending = ref<RsvpResponse | null>(null);

  async function answer(
    sessionId: string,
    response: RsvpResponse,
  ): Promise<SessionDetailDto | null> {
    if (pending.value) return null;
    pending.value = response;
    tapFeedback();

    try {
      const updated = await answerSession(sessionId, { response });
      markBookingsChanged();
      toast.success(rsvpSuccessMessage(updated));
      return updated;
    } catch (error) {
      toast.error(normalizeApiError(error).message);
      return null;
    } finally {
      pending.value = null;
    }
  }

  return { answer, pending };
}
