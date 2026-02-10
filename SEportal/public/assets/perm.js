(function(){
  const ROLE_PRESETS = {
    viewer: ['product.view','inventory.view','sales.view','quotation.view'],
    staff: ['product.view','inventory.view','sales.view','quotation.view','work.view','plan.view','assign.view','order.view'],
    manager: [
      'product.view','inventory.view','sales.view','quotation.view',
      'work.view','plan.view','assign.view','order.view',
      'dispatch.view','dispatch.create','dispatch.edit','dispatch.cancel',
      'employee.view',
      'assign.print','assign.thomson','assign.coating','assign.adhesive','assign.lamination'
    ],
    admin: ['*']
  };

  function has(perm){
    const role = sessionStorage.getItem('sepnp_emp_role')||'viewer';
    const empNo = sessionStorage.getItem('sepnp_emp_no');
    if(!empNo) return false;
    if(role==='admin') return true;
    try{
      const permsJson = sessionStorage.getItem('sepnp_emp_perms');
      const perms = permsJson ? JSON.parse(permsJson) : (ROLE_PRESETS[role] || []);
      return perms.includes('*') || perms.includes(perm);
    }catch(e){ return ROLE_PRESETS[role]?.includes(perm) || false; }
  }

  function applyGates(root=document){
    root.querySelectorAll('[data-perm]').forEach(el=>{
      const perm = el.dataset.perm;
      const mode = el.dataset.permMode || 'disable';
      if(!has(perm)){
        if(mode==='hide') el.style.display='none';
        else{ el.disabled=true; el.style.opacity='0.4'; el.style.cursor='not-allowed'; }
      }else{
        if(mode==='hide') el.style.display='';
        else{ el.disabled=false; el.style.opacity=''; el.style.cursor=''; }
      }
    });
  }

  window.Permissions = { ROLE_PRESETS, has, applyGates };
})();