package com.joyent.piranha.pageobject;


import static com.codeborne.selenide.Selectors.byText;
import static com.codeborne.selenide.Selenide.$;
import static com.codeborne.selenide.Selenide.page;

public class Users extends AbstractPageObject {

    @Override
    String getTitle() {
        return "Users";
    }

    public CreateSubUser clickCreateUser() {
        $(byText("Create User")).click();
        waitForLargeSpinnerDisappear();
        return page(CreateSubUser.class);
    }

    public SubuserDetails openSubuserDetails(String username) {
        $(byText(username)).click();
        waitForLargeSpinnerDisappear();
        return page(SubuserDetails.class);
    }

    public String createTestSubUser() {
        CreateSubUser createSubUser = clickCreateUser();
        String login = "sub" + System.currentTimeMillis();
        createSubUser.setEmailAddress(login + "@silvetreesystems.com");
        createSubUser.setUsername(login);
        createSubUser.setPassword(login);
        createSubUser.setRepeatPassword(login);
        createSubUser.clickCreateUser();
        waitForLargeSpinnerDisappear();
        return login;
    }
}
