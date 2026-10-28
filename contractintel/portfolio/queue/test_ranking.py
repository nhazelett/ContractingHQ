import csv, io, json, pathlib, tempfile, unittest, zipfile
from rank_offices import aggregate, amount_cents, RankingError

class RankingTests(unittest.TestCase):
    def setUp(self):
        self.directory=[{"code":"A%05d"%i,"name":str(i)} for i in range(151)]
        self.config={"rankingMaxFieldBytes":10000,"rankingMaxCSVFiles":16,"rankingMaxExpandedBytes":1000000,
                     "rankingMaxRows":10000,"startDate":"2024-10-01","endDate":"2025-09-30","seedCount":150,"fiscalYear":2025}
    def archive(self,rows,headers=None):
        temp=tempfile.TemporaryFile()
        text=io.StringIO(newline="")
        writer=csv.writer(text)
        writer.writerow(headers or ["award_id_piid","federal_action_obligation","action_date"])
        writer.writerows(rows)
        with zipfile.ZipFile(temp,"w") as z: z.writestr("contracts.csv",text.getvalue())
        temp.seek(0)
        return temp
    def test_net_obligations_exact_cents_and_prefix(self):
        with self.archive([["A00000X","100.01","2025-01-01"],["A00000Y","-50.00","2025-01-02"],
                           ["A00001X","50.02","2025-09-30"],["Z99999X","10000000","2025-01-01"]]) as f:
            result=aggregate(f,self.directory,self.config)
        self.assertEqual(result["seed"][0]["office"],"A00001")
        self.assertEqual(result["seed"][1]["fy_obligations_cents"],"5001")
        self.assertEqual(result["seed"][2]["office"],"A00002")
        self.assertEqual(result["statistics"]["unmatched_rows"],1)
        self.assertEqual(len(result["seed"]),150)
    def test_bad_dates_columns_and_amounts_fail_closed(self):
        for rows,headers in [([["A00000X","1","2026-01-01"]],None),
                             ([["A00000X","NaN","2025-01-01"]],None),
                             ([["A00000X","1.001","2025-01-01"]],None),
                             ([["A00000X","1","2025-01-01"]],["piid","amount","date"])]:
            with self.subTest(rows=rows),self.archive(rows,headers) as f:
                with self.assertRaises(RankingError):aggregate(f,self.directory,self.config)
    def test_row_limit(self):
        self.config["rankingMaxRows"]=1
        with self.archive([["A00000X","1","2025-01-01"]]*2) as f:
            with self.assertRaises(RankingError):aggregate(f,self.directory,self.config)
    def test_large_decimal_no_float_rounding(self):
        self.assertEqual(amount_cents("123456789012345.67"),12345678901234567)
