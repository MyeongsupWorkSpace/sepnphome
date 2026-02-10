const express = require('express');
const router = express.Router();
const db = require('../db');

// 로그인
router.post('/login', async (req, res) => {
  try {
    const { loginId, password } = req.body;
    
    if (!loginId || !password) {
      return res.status(400).json({ 
        ok: false, 
        msg: 'ID와 비밀번호를 입력하세요.' 
      });
    }
    
    const [rows] = await db.query(
      `SELECT * FROM employees 
       WHERE (username = ? OR emp_no = ?) 
       AND status = 'active'`,
      [loginId, loginId]
    );
    
    if (rows.length === 0) {
      return res.status(401).json({ 
        ok: false, 
        msg: '계정을 찾을 수 없습니다.' 
      });
    }
    
    const emp = rows[0];
    const passwordHash = sha256(password);
    
    if (emp.password_hash !== passwordHash) {
      return res.status(401).json({ 
        ok: false, 
        msg: '비밀번호가 일치하지 않습니다.' 
      });
    }
    
    // perms JSON 파싱
    let perms = [];
    if (emp.perms) {
      perms = typeof emp.perms === 'string' 
        ? JSON.parse(emp.perms) 
        : emp.perms;
    }
    
    res.json({ 
      ok: true, 
      emp: {
        empNo: emp.emp_no,
        name: emp.name,
        role: emp.role,
        username: emp.username,
        dept: emp.dept,
        position: emp.position,
        perms: perms
      }
    });
    
    console.log(`  ✅ 로그인: ${emp.name} (${emp.username})`);
    
  } catch (error) {
    console.error('  ❌ 로그인 오류:', error);
    res.status(500).json({ 
      ok: false, 
      msg: '서버 오류가 발생했습니다.' 
    });
  }
});

// 사원 목록 조회
router.get('/employees', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT * FROM employees 
       WHERE status != 'pending' 
       ORDER BY created_at DESC`
    );
    
    const employees = rows.map(emp => ({
      ...emp,
      perms: typeof emp.perms === 'string' 
        ? JSON.parse(emp.perms) 
        : emp.perms
    }));
    
    res.json(employees);
  } catch (error) {
    console.error('  ❌ 사원 조회 오류:', error);
    res.status(500).json({ error: '서버 오류' });
  }
});

module.exports = router;