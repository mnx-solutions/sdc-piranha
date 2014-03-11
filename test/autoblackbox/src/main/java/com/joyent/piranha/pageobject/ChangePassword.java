package com.joyent.piranha.pageobject;

import static com.codeborne.selenide.Selenide.$;

public class ChangePassword extends AbstractPageObject {

    public void setOldPassword(String oldPassword){
        $("[name=\"oldPassword\"]").sendKeys(oldPassword);
    }

    public void setNewPassword(String testPass){
        $("[name=\"newPassword\"]").sendKeys(testPass);
    }

    public void setConfirmNewPassword(String testPass){
        $("[name=\"newPasswordConfirmation\"]").sendKeys(testPass);
    }

    public void clickSubmitButton(){
        $("[type=\"submit\"]").click();
    }

    public void clickCloseButton(){
        $("button.btn").click();
    }
}
