package com.mofeng.rdp.domain.cipher;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class CipherEngineTest {

    @Test
    void 加密往返() {
        String plain = "13812345678";
        String enc = CipherEngine.encryptField(plain, "master-secret", "PHONE", 1);
        assertTrue(CipherEngine.isEncrypted(enc));
        assertTrue(enc.startsWith("enc:v1:PHONE:"));
        assertEquals(plain, CipherEngine.decryptField(enc, "master-secret"));
    }

    @Test
    void 中文加密往返() {
        String plain = "张工";
        String enc = CipherEngine.encryptField(plain, "master-secret", "NAME", 2);
        assertEquals(plain, CipherEngine.decryptField(enc, "master-secret"));
    }

    @Test
    void 确定性同密钥同密文() {
        String a = CipherEngine.encryptField("abc", "k", "ID", 1);
        String b = CipherEngine.encryptField("abc", "k", "ID", 1);
        assertEquals(a, b);
    }

    @Test
    void 不同密钥不同密文() {
        String a = CipherEngine.encryptField("abc", "k1", "ID", 1);
        String b = CipherEngine.encryptField("abc", "k2", "ID", 1);
        assertNotEquals(a, b);
    }

    @Test
    void 脱敏() {
        assertEquals("138***5678", CipherEngine.maskField("13812345678", 3, 4));
        assertEquals("", CipherEngine.maskField("", 3, 4));
    }

    @Test
    void 密文检测() {
        assertTrue(CipherEngine.isEncrypted("enc:v1:PHONE:0a1b2c"));
        assertFalse(CipherEngine.isEncrypted("13812345678"));
        assertFalse(CipherEngine.isEncrypted(""));
    }
}
