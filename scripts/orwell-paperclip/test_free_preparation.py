"""Free-lane visibility must never manufacture acceptance or stale activity."""
import unittest
import bridge

KEY = 'career-history/document-tenure-dates'
NOW = 2_000_000

class FreePreparationTests(unittest.TestCase):
    def view(self, **changes):
        job = dict(productItemKey=KEY, provider='groq', state='running',
                   productAccepted=False, authorBatchCount=1, qaBatchCount=0,
                   authorModel='openai/gpt-oss-120b', reviewerModel='qwen/qwen3.8-27b',
                   sourceHash='a'*64, artifactHash='b'*64)
        job.update(changes)
        return dict(observedAt=NOW, jobs=[job])

    def test_real_preparation_can_progress_despite_native_hold(self):
        result = bridge.free_preparation_overlay(self.view(), KEY, {'done':False}, NOW)
        self.assertEqual(result['status'], 'in_progress')
        self.assertIn('1/3', result['description'])
        self.assertIn('checklist remains open', result['description'])

    def test_qa_is_review_and_preparation_acceptance_never_completes_issue(self):
        result = bridge.free_preparation_overlay(self.view(state='review'), KEY, {}, NOW)
        self.assertEqual(result['status'], 'in_review')
        result = bridge.free_preparation_overlay(self.view(state='accepted_preparation', authorBatchCount=3, qaBatchCount=3), KEY, {}, NOW)
        self.assertEqual(result['status'], 'in_review')
        self.assertIsNone(bridge.free_preparation_overlay(self.view(state='accepted_preparation'), KEY, {}, NOW))

    def test_paused_envelope_cannot_show_working(self):
        view = self.view()
        view['paused'] = True
        self.assertIsNone(bridge.free_preparation_overlay(view,KEY,{},NOW))

    def test_six_batch_coverage_requires_all_six_independent_reviews(self):
        result = bridge.free_preparation_overlay(self.view(state='accepted_preparation', batchCount=6, authorBatchCount=6, qaBatchCount=6),KEY,{},NOW)
        self.assertEqual(result['status'],'in_review')
        self.assertIn('6/6',result['description'])
        self.assertIsNone(bridge.free_preparation_overlay(self.view(state='accepted_preparation', batchCount=6, authorBatchCount=6, qaBatchCount=3),KEY,{},NOW))

    def test_stale_or_wrong_or_completed_task_does_not_override_facts(self):
        for view,key,step,now in [(self.view(),KEY,{},NOW+120001),
                                  (self.view(state='accepted_preparation',authorBatchCount=3,qaBatchCount=3),KEY,{},NOW+120001),
                                  (self.view(),'other/item',{},NOW),
                                  (self.view(),KEY,{'done':True},NOW),
                                  (self.view(productAccepted=True),KEY,{},NOW),
                                  (self.view(provider='claude'),KEY,{},NOW),
                                  (self.view(authorBatchCount=32),KEY,{},NOW)]:
            self.assertIsNone(bridge.free_preparation_overlay(view,key,step,now))

    def test_quota_wait_is_visible_without_claiming_new_inference(self):
        result = bridge.free_preparation_overlay(self.view(state='deferred', reason='Groq minute quota', retryAt=NOW+1000),KEY,{},NOW)
        self.assertEqual(result['status'],'in_progress')
        self.assertIn('Groq minute quota',result['description'])
        self.assertIsNone(bridge.free_preparation_overlay(self.view(state='queued',authorBatchCount=0),KEY,{},NOW))

if __name__ == '__main__': unittest.main()
