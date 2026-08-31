UPDATE sec_credential_envelopes
SET ciphertext = COALESCE(ciphertext, X''),
    nonce = COALESCE(nonce, X''),
    aad_hash = COALESCE(aad_hash, REPEAT('0', 64));

ALTER TABLE sec_credential_envelopes
  DROP COLUMN credential_payload,
  MODIFY COLUMN ciphertext LONGBLOB NOT NULL,
  MODIFY COLUMN nonce VARBINARY(64) NOT NULL,
  MODIFY COLUMN aad_hash CHAR(64) NOT NULL;
