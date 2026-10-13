#!/usr/bin/env python3
"""Fails unless an APK is signed with the certificate in a keystore.

Usage: check-apk-signature.py APK KEYSTORE STOREPASS ALIAS

Test APKs must always be signed with the same key: Android refuses to install an
update signed with a different one, so a changed key silently strands players on
an old version.
"""
import hashlib
import re
import struct
import subprocess
import sys


def apk_cert_sha256(path):
    d = open(path, 'rb').read()
    eocd = d.rfind(b'PK\x05\x06')
    cd_off = struct.unpack('<I', d[eocd + 16:eocd + 20])[0]
    if d[cd_off - 16:cd_off] != b'APK Sig Block 42':
        sys.exit(f'{path}: no APK signing block (v2+ signature) found')
    size = struct.unpack('<Q', d[cd_off - 24:cd_off - 16])[0]
    p, end = cd_off - size, cd_off - 24
    u32 = lambda b, o: (struct.unpack('<I', b[o:o + 4])[0], o + 4)
    while p < end:
        ln = struct.unpack('<Q', d[p:p + 8])[0]
        block_id = struct.unpack('<I', d[p + 8:p + 12])[0]
        val = d[p + 12:p + 8 + ln]
        p += 8 + ln
        if block_id == 0x7109871a:  # APK Signature Scheme v2
            n, o = u32(val, 0)
            signer = val[o:o + n]
            n, o = u32(signer, 0)
            n2, o2 = u32(signer, o)
            signed = signer[o2:o2 + n2]
            n, o = u32(signed, 0)
            o += n  # digests
            n, o = u32(signed, o)
            certs = signed[o:o + n]
            n, o = u32(certs, 0)
            return hashlib.sha256(certs[o:o + n]).hexdigest()
    sys.exit(f'{path}: no v2 signature block found')


def keystore_cert_sha256(keystore, storepass, alias):
    out = subprocess.run(['keytool', '-list', '-v', '-keystore', keystore, '-storepass', storepass, '-alias', alias],
                         capture_output=True, text=True, check=True).stdout
    m = re.search(r'SHA256:\s*([0-9A-F:]+)', out)
    return m.group(1).replace(':', '').lower()


apk, keystore, storepass, alias = sys.argv[1:5]
got, want = apk_cert_sha256(apk), keystore_cert_sha256(keystore, storepass, alias)
if got != want:
    sys.exit(f'{apk} is signed with {got}, expected the test key {want}')
print(f'{apk}: signed with the test key ({want[:16]}...)')
