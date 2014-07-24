package com.joyent.piranha.pageobject;


import static com.codeborne.selenide.Selectors.byText;
import static com.codeborne.selenide.Selenide.$;
import static com.codeborne.selenide.Selenide.page;

public class Roles extends AbstractPageObject{
    @Override
    String getTitle(){return "Roles";}

    public CreateRole clickCreateRole(){
        $(byText("Create Role")).click();
        return page(CreateRole.class);
    }

    public String createTestRole(){
        CreateRole createRole = clickCreateRole();
        String roleName = "testRole" + System.currentTimeMillis();
        createRole.setName(roleName);
        createRole.clickCreateRole();
        waitForLargeSpinnerDisappear();
        return roleName;
    }

    public RoleDetails openRoleDetails(String roleName) {
        $(byText(roleName)).click();
        waitForLargeSpinnerDisappear();
        return page(RoleDetails.class);
    }
}
