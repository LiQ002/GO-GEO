ALTER TABLE sec_credential_envelopes
  ADD COLUMN credential_payload LONGTEXT NULL AFTER algorithm,
  MODIFY COLUMN ciphertext LONGBLOB NULL,
  MODIFY COLUMN nonce VARBINARY(64) NULL,
  MODIFY COLUMN aad_hash CHAR(64) NULL;
