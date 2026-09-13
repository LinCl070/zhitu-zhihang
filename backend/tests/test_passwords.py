import unittest

from app.auth.passwords import (
    generate_temporary_password,
    hash_password,
    normalize_username,
    validate_password,
    verify_password,
)


class PasswordTests(unittest.TestCase):
    def test_scrypt_hash_verifies_only_the_original_password(self) -> None:
        stored_hash = hash_password("SecurePass9")

        self.assertNotIn("SecurePass9", stored_hash)
        self.assertTrue(verify_password("SecurePass9", stored_hash))
        self.assertFalse(verify_password("SecurePass8", stored_hash))

    def test_username_and_password_rules_are_enforced(self) -> None:
        self.assertEqual(normalize_username(" Student-A "), "student-a")
        with self.assertRaises(ValueError):
            normalize_username("管理员")
        with self.assertRaises(ValueError):
            validate_password("onlyletters")
        validate_password(generate_temporary_password())


if __name__ == "__main__":
    unittest.main()
