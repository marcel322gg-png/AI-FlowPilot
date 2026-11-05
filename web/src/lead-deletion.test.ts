import {describe,expect,it,vi} from 'vitest';
import {deleteLeadAfterConfirmation} from './lead-deletion';

const lead={id:'lead-123',name:'Maya Chen',company:'Blue Orchard Market'};

describe('confirmed lead deletion',()=>{
  it('does not send a delete request when confirmation is cancelled',async()=>{
    const confirm=vi.fn(()=>false),remove=vi.fn(async()=>undefined);
    expect(await deleteLeadAfterConfirmation(lead,confirm,remove)).toBe(false);
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('Maya Chen'));
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('Blue Orchard Market'));
    expect(remove).not.toHaveBeenCalled();
  });
  it('deletes only after confirming the named lead and company',async()=>{
    const confirm=vi.fn(()=>true),remove=vi.fn(async()=>undefined);
    expect(await deleteLeadAfterConfirmation(lead,confirm,remove)).toBe(true);
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('Maya Chen'));
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('Blue Orchard Market'));
    expect(remove).toHaveBeenCalledOnce();expect(remove).toHaveBeenCalledWith(lead.id);
  });
});
