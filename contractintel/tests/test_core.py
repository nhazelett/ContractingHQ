import csv
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest
import zipfile
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'ingest'))
from core import connect,cents,fiscal_year,normalize_igf,build_dataset,activate,export_sql
TEST_TEMP = Path(__file__).resolve().parents[1]/'.runtime/tests'
TEST_TEMP.mkdir(parents=True,exist_ok=True)


def row(key,amount,day='2025-09-30',office='FA4800',**extra):
    return {'contract_transaction_unique_key':key,'contract_award_unique_key':'AWARD_1','award_id_piid':'FA480025P0001',
            'action_date':day,'awarding_office_code':office,'awarding_office_name':office,
            'federal_action_obligation':amount,'base_and_exercised_options_value':amount,
            'base_and_all_options_value':amount,'modification_number':'0','number_of_actions':'1',
            'naics_code':'541330','product_or_service_code':'R425','total_dollars_obligated':'75.10',**extra}


class IngestionTests(unittest.TestCase):
    def test_money_and_fiscal_year(self):
        self.assertEqual(cents('-0.01'),-1)
        self.assertEqual(cents('1,234.56'),123456)
        self.assertIsNone(cents('null'))
        for bad in ('nan','Infinity','0.001','90071992547410.00'):
            with self.assertRaises(ValueError): cents(bad)
        self.assertEqual(fiscal_year('2025-09-30'),2025)
        self.assertEqual(fiscal_year('2025-10-01'),2026)
        self.assertEqual(normalize_igf('IGF::CT,IGF::CL'),'Closely associated; Critical')

    def test_versions_corrections_office_transfer_and_reconciliation(self):
        with tempfile.TemporaryDirectory(dir=TEST_TEMP) as root:
            root=Path(root)
            db=connect(root/'test.sqlite')
            rows=[row('T1','100.10'),row('T2','-25.00','2025-10-01','FA8101',
                modification_number='P00001',number_of_actions='3',naics_code='541519',
                period_of_performance_current_end_date='2027-01-01')]
            source=self.source(root/'initial.zip',rows)
            version=build_dataset(db,[source],'2025-09-30','2025-10-01')
            self.assertEqual(build_dataset(db,[source],'2025-09-30','2025-10-01'),version)
            award=db.execute('SELECT * FROM awards').fetchone()
            self.assertEqual((award['office_code'],award['obligation_cents'],award['transaction_count'],award['number_of_actions']),('FA8101',7510,2,4))
            self.assertEqual(award['current_value_cents'],7510) # Never sums the repeated award totals.
            self.assertEqual(award['current_end_date'],'2027-01-01')
            self.assertEqual(award['history_complete'],0) # Matching totals cannot prove all zero-dollar modifications were loaded.
            rollups=db.execute("SELECT office_code,fiscal_year,obligation_cents FROM fy_obligations WHERE dimension='all' ORDER BY fiscal_year").fetchall()
            self.assertEqual([tuple(r) for r in rollups],[('FA4800',2025,10010),('FA8101',2026,-2500)])
            activate(db,version)
            # Replacing a complete source partition removes a deleted transaction.
            replacement=self.source(root/'corrected.zip',[row('T1','80.00',total_dollars_obligated='80.00')])
            second=build_dataset(db,[replacement],'2025-09-30','2025-10-01')
            self.assertNotEqual(version,second)
            self.assertEqual(db.execute('SELECT version_id FROM active_dataset').fetchone()[0],version)
            self.assertEqual(db.execute('SELECT transaction_count FROM dataset_versions WHERE id=?',(second,)).fetchone()[0],1)
            export_sql(db,second,root/'sql')
            remote=connect(root/'remote.sqlite')
            for part in sorted((root/'sql').glob('*.sql')): remote.executescript(part.read_text())
            self.assertEqual(remote.execute('SELECT count(*) FROM transactions').fetchone()[0],1)
            self.assertFalse(remote.execute('PRAGMA foreign_key_check').fetchall())
            activate(db,second)
            self.assertEqual(db.execute('SELECT version_id FROM active_dataset').fetchone()[0],second)
            db.close(); remote.close()

    def test_invalid_row_never_replaces_live_version(self):
        with tempfile.TemporaryDirectory(dir=TEST_TEMP) as root:
            root=Path(root); db=connect(root/'test.sqlite')
            source=self.source(root/'valid.zip',[row('T1','75.10')])
            version=build_dataset(db,[source],'2025-09-30','2025-09-30'); activate(db,version)
            source=self.source(root/'invalid.zip',[row('T2','NaN')])
            with self.assertRaises(ValueError): build_dataset(db,[source],'2025-09-30','2025-09-30')
            self.assertEqual(db.execute('SELECT version_id FROM active_dataset').fetchone()[0],version)
            self.assertEqual(db.execute('SELECT count(*) FROM dataset_versions').fetchone()[0],1)
            db.close()

    @staticmethod
    def source(path,rows):
        stream=io.StringIO(); writer=csv.DictWriter(stream,fieldnames=sorted(set().union(*(r.keys() for r in rows))))
        writer.writeheader(); writer.writerows(rows)
        with zipfile.ZipFile(path,'w',zipfile.ZIP_DEFLATED) as archive: archive.writestr('contracts.csv',stream.getvalue())
        return {'path':str(path),'source_url':'https://files.usaspending.gov/test.zip','request':{},'downloaded_at':'2026-10-20T00:00:00Z'}


if __name__=='__main__': unittest.main()
