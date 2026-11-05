export type DeletableLead={id:string;name:string;company?:string|null};

export async function deleteLeadAfterConfirmation(
  lead:DeletableLead,
  confirmAction:(message:string)=>boolean,
  deleteAction:(id:string)=>Promise<unknown>
):Promise<boolean>{
  const company=lead.company?.trim()||'Independent';
  if(!confirmAction(`Permanently delete ${lead.name} at ${company}, including its activity history?`))return false;
  await deleteAction(lead.id);
  return true;
}
