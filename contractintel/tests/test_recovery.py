import io
from pathlib import Path
import sys
import unittest
from unittest.mock import Mock,patch
import urllib.error
import urllib.request
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'ingest'))
from bulk import open_source
from pipeline import retained_partition,sources_in_window

class RecoveryTests(unittest.TestCase):
    def test_transient_get_retries_without_exposing_url(self):
        error=urllib.error.HTTPError('https://api.usaspending.gov/private?token=hidden',503,'untrusted body',{},io.BytesIO())
        response=Mock()
        opener=Mock();opener.open.side_effect=[error,response]
        with patch('bulk.urllib.request.build_opener',return_value=opener),patch('bulk.time.sleep') as sleep:
            self.assertIs(open_source('https://api.usaspending.gov/status','export status'),response)
            sleep.assert_called_once_with(2)
            self.assertEqual(opener.open.call_count,2)

    def test_export_creation_is_not_retried_and_errors_are_sanitized(self):
        error=urllib.error.HTTPError('https://api.usaspending.gov/private?token=hidden',429,'untrusted body',{},io.BytesIO())
        opener=Mock();opener.open.side_effect=error
        req=urllib.request.Request('https://api.usaspending.gov/create',data=b'{}')
        with patch('bulk.urllib.request.build_opener',return_value=opener),patch('bulk.time.sleep') as sleep:
            with self.assertRaisesRegex(RuntimeError,'export creation failed: HTTP 429') as raised:
                open_source(req,'export creation')
            self.assertNotIn('hidden',str(raised.exception));self.assertNotIn('untrusted',str(raised.exception))
            self.assertEqual(opener.open.call_count,1);sleep.assert_not_called()

    def test_permanent_get_error_does_not_retry(self):
        opener=Mock();opener.open.side_effect=urllib.error.HTTPError('https://api.usaspending.gov/status',404,'missing',{},io.BytesIO())
        with patch('bulk.urllib.request.build_opener',return_value=opener),patch('bulk.time.sleep') as sleep:
            with self.assertRaisesRegex(RuntimeError,'HTTP 404'):open_source('https://api.usaspending.gov/status','export status')
            sleep.assert_not_called()

    def test_resume_requires_exact_window_and_build_excludes_older_archives(self):
        def source(start,end):return {'request':{'filters':{'date_range':{'start_date':start,'end_date':end}}}}
        old=source('2000-10-01','2000-10-31');jan=source('2026-01-01','2026-01-31');feb=source('2026-02-01','2026-02-28')
        catalog={'partitions':{'2000-10':old,'2026-01':jan,'2026-02':feb}}
        self.assertIs(retained_partition(catalog,'2026-02-01','2026-02-28'),feb)
        self.assertIsNone(retained_partition(catalog,'2026-02-01','2026-02-15'))
        self.assertEqual(sources_in_window(catalog,'2026-01-01','2026-02-28',True),[jan,feb])
        self.assertIn('2000-10',catalog['partitions'])
        with self.assertRaisesRegex(ValueError,'gap'):sources_in_window(catalog,'2000-10-01','2026-02-28',True)
        with self.assertRaisesRegex(ValueError,'incomplete'):sources_in_window(catalog,'2025-12-01','2026-02-28',True)

if __name__=='__main__':unittest.main()
