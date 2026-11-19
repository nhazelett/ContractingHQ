import unittest
from unittest.mock import patch
import fetch_asbca_decisions as m

class DispositionTests(unittest.TestCase):
    def test_historical_dismissal_does_not_override_current_motion(self):
        text='The appeal was dismissed in 2020 for lack of jurisdiction.\nCONCLUSION\nWe grant the Army’s motion for summary judgment.\nDated: October 23, 2026'
        current=m.disposition_text(text)
        self.assertEqual(m.classify_outcome('Decision',current),'procedural')
        self.assertEqual(m.relevant_sentences(text),"We grant the Army's motion for summary judgment.")
        self.assertNotIn('Jurisdiction',m.classify_topics(current,''))
    def test_partial_dismissal_is_not_case_dismissal(self):
        text='CONCLUSION\nWe grant the motion and dismiss Claim 1. We stay the remainder for 30 days.\nDated: today'
        self.assertEqual(m.classify_outcome('Decision',m.disposition_text(text)),'procedural')
    def test_withdrawal(self):
        text='ORDER OF DISMISSAL\nThe appeal has been withdrawn. Accordingly, it is dismissed from the Board’s docket with prejudice.\nDated: today'
        self.assertEqual(m.classify_outcome('Dismissal',m.disposition_text(text)),'dismissed')
        self.assertIn('withdrawn',m.relevant_sentences(text))
    def test_settlement_and_consent(self):
        for text,expected in [('The dispute has been settled. The appeal is dismissed with prejudice.','dismissed'),('The appeal is sustained. In the nature of a consent judgment, we award $100.','settled')]:
            self.assertEqual(m.classify_outcome('Decision',text),expected)
    def test_short_consent_order(self):
        text="OPINION BY ADMINISTRATIVE JUDGE SWEET\nThe parties resolved their dispute.\nIt is the Board's decision, pursuant to law, that the appeal is sustained. In the nature of a consent judgment, we award 2\n\n$100.\nDated: today"
        current=m.disposition_text(text)
        self.assertEqual(m.classify_outcome('Decision',current),'settled')
        self.assertNotIn('2 $100',current)
    def test_long_order_excerpt_retains_disposition(self):
        text='ORDER OF DISMISSAL\n' + 'Earlier procedural history. '*50 + 'Accordingly, the appeal is dismissed.\nDated: today'
        self.assertTrue(m.relevant_sentences(text).endswith('the appeal is dismissed.'))
    def test_abstains_without_current_section(self):
        text='An earlier appeal is dismissed. Administrative Judge Smith'
        self.assertEqual(m.relevant_sentences(text),'')
        self.assertEqual(m.classify_outcome('Dismissal',''),'unclassified')
    def test_reader_error(self):
        with self.assertRaises(ValueError):m.verified_pdf_text('Title: 404 Error Page\nMarkdown Content:\nARMED SERVICES BOARD OF CONTRACT APPEALS',[])
    def test_caption_mismatch(self):
        with self.assertRaises(ValueError):m.verified_pdf_text('ARMED SERVICES BOARD OF CONTRACT APPEALS\nASBCA No. 62082\nAdministrative Judge', ['ASBCA No. 64505'])
    def test_conflicting_final_outcomes_abstain(self):
        self.assertEqual(m.classify_outcome('Decision','The appeal is sustained. The appeal is denied.'),'unclassified')
    def test_citation_cannot_validate_wrong_caption(self):
        text='ARMED SERVICES BOARD OF CONTRACT APPEALS\nAppeal of - Example ASBCA No. 62082\nUnder Contract X\nAdministrative Judge\nWe cite ASBCA No. 64505.'
        with self.assertRaises(ValueError):m.verified_pdf_text(text,['ASBCA No. 64505'])
    def test_unknown_caption_abstains(self):
        with self.assertRaises(ValueError):m.verified_pdf_text('ARMED SERVICES BOARD OF CONTRACT APPEALS\nAdministrative Judge',[])
    def test_parenthesized_url(self):
        line='October 7, 2026 64019[Xerox Corporation](https://www.asbca.mil/64019%20Xerox%20(Dismissal)%2010.7.2026.pdf?ver=abc)Wilson'
        rows=m.parse_markdown_index(line)
        self.assertEqual(len(rows),1)
        self.assertTrue(rows[0].pdf_url.endswith('(Dismissal)%2010.7.2026.pdf?ver=abc'))
        self.assertEqual(rows[0].judge,'Wilson')
    @patch.object(m.time,'sleep')
    def test_unavailable_source_not_inferred_from_filename(self,_):
        meta=m.DecisionMeta(date='2026-10-07',numbers=['ASBCA No. 64019'],case_name='Xerox',pdf_url='https://www.asbca.mil/64019-Dismissal.pdf',judge='Wilson')
        with patch.object(m,'fetch_reader_with_retry',return_value='Title: 404 Error Page'):
            item=m.build_item(meta,0)
        self.assertEqual(item['sourceStatus'],'metadata-only')
        self.assertEqual(item['outcome'],'unclassified')
        self.assertTrue(item['sourceError'])

if __name__=='__main__':unittest.main()
