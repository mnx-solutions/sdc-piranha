package com.joyent.piranha.pageobject;

import static com.codeborne.selenide.Selectors.byText;
import static com.codeborne.selenide.Selenide.$;
import static com.codeborne.selenide.Selenide.page;

public class SideBarMenu extends AbstractPageObject {

    public Dashboard clickDashboard() {
        clickMenu(DASHBOARD_MENU_TITLE);
        return page(Dashboard.class);
    }

    public Storage clickStorage() {
        clickMenu(STORAGE_MENU_TITLE);
        return page(Storage.class);
    }

    public Instances clickCompute() {
        clickMenu(COMPUTE_MENU_TITLE);
        return page(Instances.class);
    }

    public void clickMenu(final String title) {
        $(byText(title)).click();
    }

    public FirewallRules openFirewallPage() {
        clickMenu(COMPUTE_MENU_TITLE);
        clickMenu(FIREWALL_MENU_TITLE);
        return page(FirewallRules.class);
    }

    public ImageList clickImages() {
        clickMenu(COMPUTE_MENU_TITLE);
        clickMenu(IMAGES_MENU_TITLE);
        return page(ImageList.class);
    }

    public <T extends AbstractPageObject> T clickLoadBalancers(Class<T> aClass) {
        clickMenu(COMPUTE_MENU_TITLE);
        clickMenu(SLB_MENU_TITLE);
        waitForLargeSpinnerDisappear();
        return page(aClass);
    }

    public Usage clickUsage() {
        clickMenu(USAGE_MENU_TITLE);
        return page(Usage.class);

    }

    public Users clickAccount() {
        clickMenu(ACCOUNT_MENU_TITLE);
        return page(Users.class);
    }

    public Roles clickRoles() {
        clickAccount();
        clickMenu(ROLES_MENU_TITLE);
        return page(Roles.class);
    }

    public Policies clickPolicies() {
        clickAccount();
        clickMenu(POLICIES_MENU_TITLE);
        return page(Policies.class);
    }

    public FileManager clickFileManager() {
        clickStorage();
        clickMenu(FILE_MANAGER_MENU_TITLE);
        return page(FileManager.class);
    }
}
