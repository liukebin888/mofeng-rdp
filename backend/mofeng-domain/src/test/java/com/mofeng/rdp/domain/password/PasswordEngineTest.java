package com.mofeng.rdp.domain.password;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class PasswordEngineTest {

    @Test
    void 盐随机且长度32() {
        String s1 = PasswordEngine.generateSalt();
        String s2 = PasswordEngine.generateSalt();
        assertEquals(32, s1.length());
        assertNotEquals(s1, s2);
    }

    @Test
    void 哈希确定性() {
        String h1 = PasswordEngine.hashPassword("secret", "abc", 100);
        String h2 = PasswordEngine.hashPassword("secret", "abc", 100);
        assertEquals(h1, h2);
        assertEquals(64, h1.length());
    }

    @Test
    void 口令编解码往返() {
        String encoded = PasswordEngine.encodePassword("MyPass123!", 1000);
        assertTrue(PasswordEngine.verifyPassword("MyPass123!", encoded));
        assertFalse(PasswordEngine.verifyPassword("WrongPass", encoded));
    }

    @Test
    void 恒等时间比较() {
        assertTrue(PasswordEngine.timingSafeEqual("abc", "abc"));
        assertFalse(PasswordEngine.timingSafeEqual("abc", "abd"));
        assertFalse(PasswordEngine.timingSafeEqual("abc", "ab"));
    }

    @Test
    void 口令强度() {
        assertFalse(PasswordEngine.passwordStrength("short").ok); // 长度不足
        assertFalse(PasswordEngine.passwordStrength("abcdefgh").ok); // 仅 1 类
        assertFalse(PasswordEngine.passwordStrength("Abcdefgh").ok); // 仅 2 类
        assertTrue(PasswordEngine.passwordStrength("Abcdefg1").ok); // 3 类
        assertTrue(PasswordEngine.passwordStrength("Abcdefg1!").ok); // 4 类
    }
}
