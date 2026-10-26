"""Bounded read-only credential check; never log account data or credentials."""
import sys
from cloud import cf


def main():
    checks = (
        ('D1 database listing', '/d1/database?per_page=1'),
        ('R2 bucket listing', '/r2/buckets?per_page=1'),
        ('Workers script listing', '/workers/scripts'),
    )
    failed = False
    for label, path in checks:
        try:
            cf(path)
        except RuntimeError as error:
            # cf emits only controlled messages, never provider response bodies.
            print(label + ': FAILED - ' + str(error))
            failed = True
        else:
            print(label + ': PASS')
    if failed:
        return 1
    print('Account access verified. No resources were created or modified; write permissions remain untested.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
